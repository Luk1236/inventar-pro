# app/database.py
from motor.motor_asyncio import AsyncIOMotorClient
from .config import settings

client: AsyncIOMotorClient = None
db = None

async def connect_to_database():
    """Connect to MongoDB and initialize database reference."""
    global client, db
    client = AsyncIOMotorClient(settings.MONGO_URL)
    db = client[settings.DB_NAME]
    return db

async def close_database_connection():
    """Close database connection."""
    global client
    if client:
        client.close()