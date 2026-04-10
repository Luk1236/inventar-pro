"""
One-time migration: fix UTF-8 double-encoding in MongoDB.
Run: py -3.12 fix_encoding.py
"""
import asyncio
import motor.motor_asyncio
from dotenv import load_dotenv
import os, pathlib

# Load .env from same directory as this script
load_dotenv(pathlib.Path(__file__).parent / '.env')
MONGODB_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "inventory_db")

client = motor.motor_asyncio.AsyncIOMotorClient(MONGODB_URL)
db = client[DB_NAME]


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


async def main():
    total_fixed = 0
    for coll_name in COLLECTIONS:
        coll = db[coll_name]
        count = 0
        async for doc in coll.find({}):
            doc_id = doc['_id']
            work_doc = {k: v for k, v in doc.items() if k != '_id'}
            if fix_doc(work_doc):
                await coll.update_one({'_id': doc_id}, {'$set': work_doc})
                count += 1
        print(f"  {coll_name}: {count} documents fixed")
        total_fixed += count
    print(f"\nTotal: {total_fixed} documents fixed")


if __name__ == '__main__':
    asyncio.run(main())
