import asyncio
import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional
from fastapi import WebSocket, WebSocketDisconnect
from jose import jwt, JWTError
from motor.motor_asyncio import AsyncIOMotorClient

logger = logging.getLogger(__name__)

# Load .env so SECRET_KEY is available when this module is imported standalone
# (server.py calls load_dotenv() AFTER importing this module)
try:
    from dotenv import load_dotenv as _load_dotenv
    _load_dotenv(Path(__file__).parent / ".env")
except ImportError:
    pass  # python-dotenv not installed — rely on env being set externally

MAX_CONNECTIONS = 1000  # Prevent resource exhaustion via connection flooding

# MongoDB connection for ws_tokens collection
_db_client = None
_db = None

def _get_db():
    """Get database connection lazily."""
    global _db_client, _db
    if _db is None:
        mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
        db_name = os.environ.get("DB_NAME", "inventory_db")
        _db_client = AsyncIOMotorClient(mongo_url)
        _db = _db_client[db_name]
    return _db


def _get_secret_key() -> str:
    """Read SECRET_KEY lazily so late load_dotenv() calls in server.py still work."""
    key = os.environ.get("SECRET_KEY", "")
    if not key:
        raise RuntimeError(
            "SECRET_KEY environment variable must be set — refusing to validate WS token with empty key"
        )
    return key


async def _validate_ws_token(token: str) -> Optional[dict]:
    """
    Validate WebSocket token. Supports two methods:
    1. One-time ws_token from /api/ws-token endpoint (preferred, more secure)
    2. JWT access token via query param (backward compatible, less secure)

    Returns user info dict if valid, None otherwise.
    """
    # Method 1: Check if it's a one-time ws_token
    db = _get_db()
    ws_token_doc = await db.ws_tokens.find_one({
        "token": token,
        "used": False,
        "expires_at": {"$gt": datetime.now(timezone.utc)}
    })

    if ws_token_doc:
        # Mark token as used (one-time use)
        await db.ws_tokens.update_one(
            {"token": token},
            {"$set": {"used": True}}
        )
        return {
            "user_id": ws_token_doc["user_id"],
            "username": ws_token_doc["username"]
        }

    # Method 2: Fallback to JWT access token validation
    try:
        secret = _get_secret_key()
        payload = jwt.decode(token, secret, algorithms=["HS256"])
        # Must be an access token (not refresh)
        if payload.get("type") == "refresh":
            return None
        if not payload.get("sub"):
            return None
        return {
            "user_id": payload.get("sub"),
            "username": payload.get("sub")
        }
    except (JWTError, RuntimeError):
        return None


class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket):
        async with self._lock:
            if len(self.active_connections) >= MAX_CONNECTIONS:
                await websocket.close(code=1008, reason="Server at capacity")
                return
            await websocket.accept()
            self.active_connections.append(websocket)

    async def disconnect(self, websocket: WebSocket):
        async with self._lock:
            if websocket in self.active_connections:
                self.active_connections.remove(websocket)

    async def broadcast(self, message: str):
        async with self._lock:
            connections = list(self.active_connections)
        disconnected = []
        for connection in connections:
            try:
                await connection.send_text(message)
            except Exception as e:
                logger.warning(f"WebSocket send failed, removing connection: {e}")
                disconnected.append(connection)
                try:
                    await connection.close(code=1000)
                except Exception:
                    pass  # Already closed
        if disconnected:
            async with self._lock:
                for conn in disconnected:
                    if conn in self.active_connections:
                        self.active_connections.remove(conn)


manager = ConnectionManager()


async def websocket_endpoint(websocket: WebSocket):
    """
    WebSocket endpoint with secure token validation.
    Supports two authentication methods:
    1. One-time ws_token from /api/ws-token (preferred)
    2. JWT access token via query param (backward compatible)
    """
    token = websocket.query_params.get("token", "")
    if not token:
        await websocket.close(code=4001)
        logger.warning("WebSocket rejected: missing token from %s",
                       websocket.client.host if websocket.client else "unknown")
        return

    user_info = await _validate_ws_token(token)
    if not user_info:
        await websocket.close(code=4001)
        logger.warning("WebSocket rejected: invalid or expired token from %s",
                       websocket.client.host if websocket.client else "unknown")
        return

    # Store user info in websocket scope for potential use in handlers
    websocket.scope["user"] = user_info

    await manager.connect(websocket)
    try:
        while True:
            # 60-second timeout — detects dead connections without blocking forever
            try:
                await asyncio.wait_for(websocket.receive_text(), timeout=60.0)
            except asyncio.TimeoutError:
                # Connection still alive but idle — send keep-alive ping
                try:
                    await websocket.send_text('{"type":"ping"}')
                except Exception:
                    break  # Connection dead, exit loop
    except WebSocketDisconnect:
        pass
    finally:
        await manager.disconnect(websocket)
