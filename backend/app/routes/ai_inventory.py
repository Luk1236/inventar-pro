"""AI-gestützte Inventur-Endpoints mit Per-User-Rate-Limit (Kostenschutz)."""
import os
import time
import logging
from collections import defaultdict, deque
from threading import Lock
from fastapi import APIRouter, Depends, HTTPException, Body
from app.services.ai_vision import detect_article_from_image, is_available, AIVisionError
from app.deps.auth import get_current_user

logger = logging.getLogger(__name__)

# Rate-Limit Konfiguration (per User):
AI_LIMIT_PER_HOUR = int(os.environ.get("AI_LIMIT_PER_HOUR", "20"))
AI_LIMIT_PER_DAY = int(os.environ.get("AI_LIMIT_PER_DAY", "100"))
AI_MAX_IMAGE_BYTES = int(os.environ.get("AI_MAX_IMAGE_BYTES", str(5 * 1024 * 1024)))  # 5 MB

_user_calls: dict[str, deque] = defaultdict(deque)
_lock = Lock()

router = APIRouter(prefix="/ai", tags=["ai"])


def _check_rate_limit(user_id: str) -> tuple[bool, str, dict]:
    """Prüft Rate-Limit. Gibt (erlaubt, fehlerNachricht, stats) zurück."""
    now = time.time()
    hour_ago = now - 3600
    day_ago = now - 86400
    with _lock:
        calls = _user_calls[user_id]
        while calls and calls[0] < day_ago:
            calls.popleft()
        last_hour = sum(1 for t in calls if t > hour_ago)
        last_day = len(calls)
        stats = {
            "calls_last_hour": last_hour,
            "calls_last_day": last_day,
            "limit_per_hour": AI_LIMIT_PER_HOUR,
            "limit_per_day": AI_LIMIT_PER_DAY,
        }
        if last_hour >= AI_LIMIT_PER_HOUR:
            return False, f"Stündliches Limit erreicht ({AI_LIMIT_PER_HOUR}/h). Versuche es später erneut.", stats
        if last_day >= AI_LIMIT_PER_DAY:
            return False, f"Tägliches Limit erreicht ({AI_LIMIT_PER_DAY}/Tag).", stats
        return True, "", stats


def _record_call(user_id: str):
    with _lock:
        _user_calls[user_id].append(time.time())


def _user_id_of(current_user) -> str:
    return getattr(current_user, "id", None) or getattr(current_user, "username", None) or str(current_user)


@router.get("/status")
async def ai_status(current_user=Depends(get_current_user)):
    available, info = is_available()
    _, _, stats = _check_rate_limit(_user_id_of(current_user))
    return {
        "available": available,
        "provider": info if available else None,
        "msg": info,
        "rate_limit": stats,
    }


@router.post("/detect-article")
async def detect_article(
    payload: dict = Body(...),
    current_user=Depends(get_current_user),
):
    user_id = _user_id_of(current_user)

    allowed, err_msg, stats = _check_rate_limit(user_id)
    if not allowed:
        logger.warning(f"AI rate-limit erreicht für user={user_id}: {stats}")
        raise HTTPException(status_code=429, detail=err_msg)

    image_b64 = payload.get("image_base64") or payload.get("image")
    if not image_b64:
        raise HTTPException(status_code=400, detail="image_base64 fehlt")

    # Image-Size-Check: große Bilder kosten mehr API-Tokens
    raw_size = len(image_b64) * 3 // 4
    if raw_size > AI_MAX_IMAGE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"Bild zu groß ({raw_size // 1024} KB). Max: {AI_MAX_IMAGE_BYTES // 1024} KB"
        )

    # Call ZÄHLEN bevor wir den teuren API-Call machen,
    # damit selbst bei Provider-Fehlern das Rate-Limit greift.
    _record_call(user_id)

    try:
        result = detect_article_from_image(image_b64)
        logger.info(f"AI detect erfolgreich user={user_id} ({stats['calls_last_hour']+1}/h, {stats['calls_last_day']+1}/d)")
        return {"ok": True, "data": result, "rate_limit": stats}
    except AIVisionError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.exception("AI-Erkennung fehlgeschlagen")
        raise HTTPException(status_code=500, detail=f"AI-Erkennung fehlgeschlagen: {e}")
