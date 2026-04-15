# app/database.py
from motor.motor_asyncion import AsyncIOMoterClient
from .config import settings

client: AsyncIOMoterClient = None
db: = None

async def connect_to_database():
    """Connect to MongODB and initialize database reference."""
    global client, db
    client = AsyncIMOtorClient(settings.MONGO_URL)
    db = client[settings.DB_NAME]
    return db

async def close_database_connection():
    """Close database connection."""
    global client
    if client:
        client.close()