"""
One-time migration: fix UTF-8 double-encoding in MongoDB.
Run: py -3.12 fix_encoding.py [--dry-run] [--reset-checkpoint]
"""
import argparse
import asyncio
import json
import logging
import os
import pathlib
import sys

import bson
import motor.motor_asyncio
from dotenv import load_dotenv

# ── Paths ────────────────────────────────────────────────────────────────────
_SCRIPT_DIR = pathlib.Path(__file__).parent
load_dotenv(_SCRIPT_DIR / '.env')

MONGODB_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "inventory_db")

CHECKPOINT_FILE = _SCRIPT_DIR / "fix_encoding_checkpoint.json"
LOG_FILE = _SCRIPT_DIR / "fix_encoding.log"

# ── Logging ──────────────────────────────────────────────────────────────────
_fmt = logging.Formatter("%(asctime)s %(levelname)s %(message)s")

_file_handler = logging.FileHandler(LOG_FILE, encoding="utf-8")
_file_handler.setFormatter(_fmt)

_stdout_handler = logging.StreamHandler(sys.stdout)
_stdout_handler.setFormatter(_fmt)

log = logging.getLogger("fix_encoding")
log.setLevel(logging.DEBUG)
log.addHandler(_file_handler)
log.addHandler(_stdout_handler)


# ── Core helpers (unchanged) ──────────────────────────────────────────────────
def fix_string(s: str) -> str:
    """Attempt to fix a double-encoded UTF-8 string."""
    if not isinstance(s, str):
        return s
    try:
        fixed = s.encode('latin-1').decode('utf-8')
        return fixed if fixed != s else s
    except (UnicodeEncodeError, UnicodeDecodeError):
        return s


def fix_doc(doc: dict) -> bool:
    """Recursively fix all string fields in-place. Returns True if any field changed."""
    changed = False
    for key, value in list(doc.items()):
        if key == '_id':
            continue
        if isinstance(value, str):
            fixed = fix_string(value)
            if fixed != value:
                doc[key] = fixed
                changed = True
        elif isinstance(value, dict):
            if fix_doc(value):
                changed = True
        elif isinstance(value, list):
            for i, item in enumerate(value):
                if isinstance(item, str):
                    fixed = fix_string(item)
                    if fixed != item:
                        value[i] = fixed
                        changed = True
                elif isinstance(item, dict):
                    if fix_doc(item):
                        changed = True
    return changed


COLLECTIONS = [
    "users", "articles", "categories", "customers", "events",
    "bookings", "suppliers", "crew", "vehicles", "teams",
    "maintenance_tasks", "maintenance_records", "invoices", "quotes",
    "movements", "storage_zones", "storage_locations",
]


# ── Checkpoint helpers ────────────────────────────────────────────────────────
def load_checkpoint() -> dict:
    """Load checkpoint from disk, or return a fresh one with all collections set to null."""
    if CHECKPOINT_FILE.exists():
        with open(CHECKPOINT_FILE, encoding="utf-8") as f:
            try:
                data = json.load(f)
            except json.JSONDecodeError:
                log.warning("Checkpoint file is corrupted — starting from scratch.")
                return {coll: None for coll in COLLECTIONS}
        # Ensure every collection has an entry (handles new collections added later)
        for coll in COLLECTIONS:
            data.setdefault(coll, None)
        return data
    return {coll: None for coll in COLLECTIONS}


def save_checkpoint(checkpoint: dict) -> None:
    """Persist checkpoint to disk atomically."""
    tmp = CHECKPOINT_FILE.with_suffix(".tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(checkpoint, f, indent=2)
    tmp.replace(CHECKPOINT_FILE)


def delete_checkpoint() -> None:
    """Remove checkpoint file so the script restarts from scratch."""
    if CHECKPOINT_FILE.exists():
        CHECKPOINT_FILE.unlink()
        log.info("Checkpoint file deleted — starting from scratch.")
    else:
        log.info("No checkpoint file found; nothing to reset.")


# ── Main migration ────────────────────────────────────────────────────────────
async def main(dry_run: bool) -> None:
    client = motor.motor_asyncio.AsyncIOMotorClient(MONGODB_URL)
    db = client[DB_NAME]
    try:
        checkpoint = load_checkpoint()
        total_fixed = 0

        for coll_name in COLLECTIONS:
            coll = db[coll_name]
            count = 0
            last_id = checkpoint.get(coll_name)

            # Build query: if we have a checkpoint id, resume after it
            if last_id:
                try:
                    query = {"_id": {"$gt": bson.ObjectId(last_id)}}
                except bson.errors.InvalidId:
                    log.warning(
                        "Invalid ObjectId in checkpoint for [%s]: %r — restarting collection from beginning.",
                        coll_name, last_id,
                    )
                    query = {}
            else:
                query = {}

            async for doc in coll.find(query).sort("_id", 1):
                doc_id = doc['_id']
                work_doc = {k: v for k, v in doc.items() if k != '_id'}

                if fix_doc(work_doc):
                    if dry_run:
                        log.info("DRY-RUN: Would fix [%s] _id=%s", coll_name, doc_id)
                    else:
                        await coll.update_one({'_id': doc_id}, {'$set': work_doc})
                        log.info("Fixed [%s] _id=%s", coll_name, doc_id)
                        # Save checkpoint after every successful write
                        checkpoint[coll_name] = str(doc_id)
                        save_checkpoint(checkpoint)
                    count += 1

            log.info("  %s: %d documents %s", coll_name, count,
                     "would be fixed" if dry_run else "fixed")
            total_fixed += count

        log.info("Total fixed: %d documents", total_fixed)
    finally:
        client.close()


# ── Entry point ───────────────────────────────────────────────────────────────
if __name__ == '__main__':
    parser = argparse.ArgumentParser(
        description="Fix UTF-8 double-encoding in MongoDB inventory_db."
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Only log what would be changed; perform no write operations.",
    )
    parser.add_argument(
        "--reset-checkpoint",
        action="store_true",
        help="Delete the checkpoint file and start from scratch.",
    )
    args = parser.parse_args()

    if args.reset_checkpoint:
        delete_checkpoint()

    if not args.dry_run:
        print(
            "\nWARNUNG: Erstelle vor der Migration ein Backup: "
            "mongodump --db inventory_db"
        )
        answer = input("Weiter? [j/N]: ").strip().lower()
        if answer != "j":
            print("Abgebrochen.")
            sys.exit(0)

    asyncio.run(main(dry_run=args.dry_run))
