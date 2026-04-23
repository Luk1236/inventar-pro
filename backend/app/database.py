# app/database.py
"""MongoDB connection — eagerly initialized at import time so module-level code
can reference ``client``/``db`` without an explicit connect step (mirrors the
historical behavior of ``backend/server.py``)."""
from motor.motor_asyncio import AsyncIOMotorClient

from .config import settings

client: AsyncIOMotorClient = AsyncIOMotorClient(settings.MONGO_URL)
db = client[settings.DB_NAME]


async def connect_to_database():
    """No-op kept for backward compatibility with older call sites."""
    return db


async def close_database_connection():
    """Close the MongoDB connection (use on app shutdown)."""
    if client is not None:
        client.close()