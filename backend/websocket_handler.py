import asyncio
import logging
import os
from pathlib import Path
from typing import List
from fastapi import WebSocket, WebSocketDisconnect
from jose import jwt, JWTError

logger = logging.getLogger(__name__)

# Load .env so SECRET_KEY is available when this module is imported standalone
# (server.py calls load_dotenv() AFTER importing this module)
try:
    from dotenv import load_dotenv as _load_dotenv
    _load_dotenv(Path(__file__).parent / ".env")
except ImportError:
    pass  # python-dotenv not installed — rely on env being set externally

MAX_CONNECTIONS = 1000  # Prevent resource exhaustion via connection flooding


def _get_secret_key() -> str:
    """Read SECRET_KEY lazily so late load_dotenv() calls in server.py still work."""
    key = os.environ.get("SECRET_KEY", "")
    if not key:
        raise RuntimeError(
            "SECRET_KEY environment variable must be set — refusing to validate WS token with empty key"
        )
    return key


def _validate_ws_token(token: str) -> bool:
    """F8: Validate JWT access token supplied via ?token= query param."""
    try:
        secret = _get_secret_key()
        payload = jwt.decode(token, secret, algorithms=["HS256"])
        # Must be an access token (not refresh)
        if payload.get("type") == "refresh":
            return False
        return bool(payload.get("sub"))
    except (JWTError, RuntimeError):
        return False


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
    # F8: Require valid JWT access token as ?token= query parameter
    token = websocket.query_params.get("token", "")
    if not token or not _validate_ws_token(token):
        await websocket.close(code=4001)
        logger.warning("WebSocket rejected: missing or invalid token from %s",
                       websocket.client.host if websocket.client else "unknown")
        return

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
