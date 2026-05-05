# app/database_indexes.py
# MongoDB indexes for optimal performance
from motor.motor_asyncio import AsyncIOMotorClient
from .config import settings

INDEX_LIST = [
    # Articles — single field
    ("articles", [("inventory_code", 1)]),
    ("articles", [("category_id", 1)]),
    ("articles", [("status", 1)]),
    ("articles", [("next_maintenance", 1)]),
    # Articles — compound (Status-Filter + Category gleichzeitig häufig)
    ("articles", [("status", 1), ("category_id", 1)]),
    ("articles", [("is_consumable", 1), ("current_stock", -1)]),

    # Bookings — single field
    ("bookings", [("event_id", 1)]),
    ("bookings", [("article_id", 1)]),
    ("bookings", [("start_date", 1)]),
    ("bookings", [("end_date", 1)]),
    # Bookings — compound (fast jede Buchungs-Query filtert event_id + status)
    ("bookings", [("event_id", 1), ("article_id", 1)]),
    ("bookings", [("event_id", 1), ("status", 1)]),
    ("bookings", [("article_id", 1), ("status", 1)]),

    # Events — single field
    ("events", [("customer_id", 1)]),
    ("events", [("start_date", 1)]),
    ("events", [("end_date", 1)]),
    # Events — compound (Kalender-View filtert immer Datum + Kunde)
    ("events", [("start_date", 1), ("customer_id", 1)]),

    # Customers — single field
    ("customers", [("name", 1)]),
    ("customers", [("email", 1)]),
    # Customers — compound (Listen-View: aktive Kunden, sortiert nach Datum)
    ("customers", [("is_active", 1), ("created_at", -1)]),

    # Maintenance — single field
    ("maintenance_tasks", [("article_id", 1)]),
    ("maintenance_tasks", [("status", 1)]),
    ("maintenance_tasks", [("next_maintenance", 1)]),
    # Maintenance — compound (Überfällig-Filter: status + Datum)
    ("maintenance_tasks", [("status", 1), ("due_date", 1)]),

    # Users
    ("users", [("username", 1)]),
    ("users", [("email", 1)]),

    # Storage
    ("storage_locations", [("zone_id", 1)]),

    # Logs
    ("audit_logs", [("user_id", 1), ("created_at", -1)]),
    ("agent_logs", [("action", 1), ("created_at", -1)]),

    # Token-Cleanup (tägl. Job löscht abgelaufene Tokens per expires_at)
    ("refresh_tokens", [("expires_at", 1)]),
    ("ws_tokens", [("expires_at", 1)]),
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