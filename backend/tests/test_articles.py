# backend/tests/test_articles.py
import pytest
import uuid


@pytest.mark.asyncio
async def test_archived_route_not_treated_as_article_id(client, auth_headers):
    """GET /api/articles/archived must not return 404 (routing conflict check)."""
    resp = await client.get("/api/articles/archived", headers=auth_headers)
    assert resp.status_code == 200, f"Routing conflict: got {resp.status_code}"
    assert isinstance(resp.json(), list)


@pytest.mark.asyncio
async def test_archived_v1_route(client, auth_headers):
    """GET /api/v1/articles/archived must also work."""
    resp = await client.get("/api/v1/articles/archived", headers=auth_headers)
    assert resp.status_code == 200, f"v1 routing conflict: got {resp.status_code}"
    assert isinstance(resp.json(), list)
