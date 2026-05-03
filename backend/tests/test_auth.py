# backend/tests/test_auth.py
import pytest
import uuid
from datetime import datetime, timezone


async def _create_approved_user(test_db, role="lager"):
    """Helper: insert an approved user directly to bypass the approval flow."""
    from server import get_password_hash
    username = f"authtest_{uuid.uuid4().hex[:8]}"
    password = "AuthTest123!"
    await test_db.users.insert_one({
        "id": str(uuid.uuid4()),
        "username": username,
        "email": f"{username}@test.com",
        "full_name": "Auth Test",
        "role": role,
        "is_approved": True,
        "hashed_password": get_password_hash(password),
        "created_at": datetime.now(timezone.utc),
        "is_active": True,
    })
    return username, password


@pytest.mark.asyncio
async def test_login_success(client, test_db):
    """Valid credentials return an access token."""
    username, password = await _create_approved_user(test_db)
    resp = await client.post("/api/login", json={"username": username, "password": password})
    assert resp.status_code == 200
    assert "access_token" in resp.json()


@pytest.mark.asyncio
async def test_login_wrong_password(client, test_db):
    """Wrong password returns 401."""
    username, _ = await _create_approved_user(test_db)
    resp = await client.post("/api/login", json={"username": username, "password": "WrongPassword!"})
    assert resp.status_code in (401, 400, 422)


@pytest.mark.asyncio
async def test_protected_endpoint_without_token(client):
    """Accessing articles without token returns 401 or 403."""
    resp = await client.get("/api/articles")
    assert resp.status_code in (401, 403)


@pytest.mark.asyncio
async def test_lager_cannot_access_admin_user_list(client, test_db):
    """User with lager role cannot list all users (admin-only endpoint)."""
    username, password = await _create_approved_user(test_db, role="lager")
    login_resp = await client.post("/api/login", json={"username": username, "password": password})
    token = login_resp.json().get("access_token", "")
    headers = {"Authorization": f"Bearer {token}"}

    resp = await client.get("/api/admin/pending-users", headers=headers)
    assert resp.status_code in (401, 403), f"Expected 401/403, got {resp.status_code}"
