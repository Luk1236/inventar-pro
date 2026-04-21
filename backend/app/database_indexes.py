# app/database_indexes.py
# MongoDB indexes for optimal performance
from motor.motor_asyncio import AsyncIOMotorClient
from .config import settings

INDEX_LIST = [
    # Articles indexes
    ("articles", [("inventory_code", 1)]),
    ("articles", [("category_id", 1)]),
    ("articles", [("status", 1)]),
    ("articles", [("is_consumable", 1), ("current_stock", -1)]),
    ("articles", [("next_maintenance", 1)]),
    # Bookings indexes
    ("bookings", [("event_id", 1)]),
    ("bookings", [("article_id", 1)]),
    ("bookings", [("start_date", 1)]),
    ("bookings", [("end_date", 1)]),
    ("bookings", [("event_id", 1), ("article_id", 1)]),
    # Events indexes
    ("events", [("customer_id", 1)]),
    ("events", [("start_date", 1)]),
    ("events", [("end_date", 1)]),
    # Customers indexes
    ("customers", [("name", 1)]),
    ("customers", [("email", 1)]),
    # Maintenance indexes
    ("maintenance_tasks", [("article_id", 1)]),
    ("maintenance_tasks", [("status", 1)]),
    ("maintenance_tasks", [("next_maintenance", 1)]),
    # Users indexes
    ("users", [("username", 1)]),
    ("users", [("email", 1)]),
    # Storage indexes
    ("storage_locations", [("zone_id", 1)]),
    # logs indexes
    ("audit_logs", [("user_id", 1), ("created_at", -1)]),
    ("agent_logs", [("action", 1), ("created_at", -1)]),
]

async def create_indexes():
    """Create all required indexes in MongoDB."""
    client = AsyncIOMotorClient(settings.MONGO_URL)
    db = client[settings.DB_NAME]

    for collection_name, index_spec in INDEX_LIST:
        collection = db[collection_name]
        try:
            await collection.create_index(index_spec)
            print(f"Created index on {collection_name}")
        except Exception as e:
            print(f"Failed to create index on {collection_name}: {e}")

    client.close()

if __name__ == "__main__":
    import asyncio
    asyncio.run(create_indexes())