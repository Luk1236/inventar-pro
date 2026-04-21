# backend/tests/test_websocket.py
"""
WebSocket unit tests — test handler logic directly without a full ASGI server.
Starlette TestClient creates its own event loop which conflicts with the session-
scoped Motor client used in the startup handler; this avoids that issue entirely.
"""
import json
import os
import pytest
from jose import jwt


def _make_token(sub: str, token_type: str = "access") -> str:
    """Generate a JWT token using the current SECRET_KEY."""
    secret = os.environ.get("SECRET_KEY", "test-secret-key-for-ws-tests")
    return jwt.encode({"sub": sub, "type": token_type}, secret, algorithm="HS256")


# ─── _validate_ws_token ───────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_ws_token_valid():
    """Valid access token passes validation."""
    import os as _os
    _os.environ.setdefault("SECRET_KEY", "test-secret-key-for-ws-tests")
    from websocket_handler import _validate_ws_token
    token = _make_token("user123")
    assert await _validate_ws_token(token) is not None


@pytest.mark.asyncio
async def test_ws_token_empty_rejected():
    """Empty token string is rejected."""
    from websocket_handler import _validate_ws_token
    assert await _validate_ws_token("") is None


@pytest.mark.asyncio
async def test_ws_token_refresh_rejected():
    """Refresh token (type=refresh) is rejected."""
    from websocket_handler import _validate_ws_token
    token = _make_token("user123", token_type="refresh")
    assert await _validate_ws_token(token) is None


@pytest.mark.asyncio
async def test_ws_token_invalid_signature_rejected():
    """Token with wrong secret is rejected."""
    token = jwt.encode({"sub": "user", "type": "access"}, "wrong-secret", algorithm="HS256")
    from websocket_handler import _validate_ws_token
    assert await _validate_ws_token(token) is None


@pytest.mark.asyncio
async def test_ws_token_no_sub_rejected():
    """Token without 'sub' claim is rejected."""
    secret = os.environ.get("SECRET_KEY", "test-secret-key-for-ws-tests")
    token = jwt.encode({"type": "access"}, secret, algorithm="HS256")
    from websocket_handler import _validate_ws_token
    assert await _validate_ws_token(token) is None


# ─── ConnectionManager ────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_connection_manager_connect_disconnect():
    """Manager tracks active connections correctly."""
    from websocket_handler import ConnectionManager
    from unittest.mock import AsyncMock, MagicMock

    manager = ConnectionManager()
    ws = MagicMock()
    ws.accept = AsyncMock()

    await manager.connect(ws)
    assert ws in manager.active_connections

    await manager.disconnect(ws)
    assert ws not in manager.active_connections


@pytest.mark.asyncio
async def test_connection_manager_broadcast():
    """Broadcast sends to all active connections."""
    from websocket_handler import ConnectionManager
    from unittest.mock import AsyncMock, MagicMock

    manager = ConnectionManager()
    ws1 = MagicMock()
    ws1.accept = AsyncMock()
    ws1.send_text = AsyncMock()
    ws2 = MagicMock()
    ws2.accept = AsyncMock()
    ws2.send_text = AsyncMock()

    await manager.connect(ws1)
    await manager.connect(ws2)
    await manager.broadcast(json.dumps({"type": "test"}))

    ws1.send_text.assert_called_once()
    ws2.send_text.assert_called_once()


@pytest.mark.asyncio
async def test_connection_manager_max_connections():
    """Manager rejects connections above MAX_CONNECTIONS."""
    from websocket_handler import ConnectionManager, MAX_CONNECTIONS
    from unittest.mock import AsyncMock, MagicMock

    manager = ConnectionManager()
    # Fill up to limit
    for _ in range(MAX_CONNECTIONS):
        ws = MagicMock()
        ws.accept = AsyncMock()
        manager.active_connections.append(ws)

    # Next connection should be closed
    extra_ws = MagicMock()
    extra_ws.accept = AsyncMock()
    extra_ws.close = AsyncMock()
    await manager.connect(extra_ws)
    extra_ws.close.assert_called_once()
    assert extra_ws not in manager.active_connections
