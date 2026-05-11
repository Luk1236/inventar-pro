"""Health-Check und Version-Info — extrahiert aus server.py."""
import os
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from app.database import db

router = APIRouter(tags=["health"])

VERSION_FILE = os.path.join(os.path.dirname(__file__), "..", "..", "..", "VERSION")


async def _health_payload():
    try:
        await db.command("ping")
        return {"status": "ok", "db": "connected", "version": _read_version()}, 200
    except Exception:
        return {"status": "degraded", "db": "unreachable", "version": _read_version()}, 503


def _read_version() -> str:
    try:
        with open(VERSION_FILE) as f:
            return f.read().strip()
    except FileNotFoundError:
        return "1.0.0"


@router.get("/health")
async def api_health_check():
    payload, status = await _health_payload()
    if status == 200:
        return payload
    return JSONResponse(payload, status_code=status)


@router.get("/version")
async def version_info():
    return {"version": _read_version()}
