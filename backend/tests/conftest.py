# backend/tests/conftest.py
import pytest_asyncio
import uuid
from datetime import datetime, timezone
from httpx import AsyncClient, ASGITransport
from motor.motor_asyncio import AsyncIOMotorClient
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

TEST_DB_NAME = "inventory_test"


@pytest_asyncio.fixture(scope="session")
async def test_db():
    """Set up test database."""
    import server
    client = AsyncIOMotorClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
    test_database = client[TEST_DB_NAME]
    original_db = server.db
    server.db = test_database
    yield test_database
    server.db = original_db
    await client.drop_database(TEST_DB_NAME)
    client.close()


@pytest_asyncio.fixture(scope="session")
async def client(test_db):
    """HTTP client for tests."""
    from server import app
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac


@pytest_asyncio.fixture(scope="session")
async def auth_headers(client, test_db):
    """Create an approved admin user directly in DB and return auth headers."""
    from server import get_password_hash

    username = f"testadmin_{uuid.uuid4().hex[:8]}"
    password = "TestPass123!"
    user_doc = {
        "id": str(uuid.uuid4()),
        "username": username,
        "email": f"{username}@test.com",
        "full_name": "Test Admin",
        "role": "admin",
        "is_approved": True,          # Bypass approval flow in tests
        "hashed_password": get_password_hash(password),
        "created_at": datetime.now(timezone.utc),
        "is_active": True,
    }
    await test_db.users.insert_one(user_doc)

    resp = await client.post("/api/login", json={
        "username": username,
        "password": password,
    })
    token = resp.json().get("access_token", "")
    return {"Authorization": f"Bearer {token}"}
