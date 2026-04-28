"""Message routes — extracted from server.py.

In-app messaging between users: list conversations, fetch a thread,
unread count, edit own message, delete own message. Pattern follows
app/routes/vehicles.py: lazy db accessor for testability, contracts
preserved exactly so the existing tests stay green.

Note: POST /messages stays in server.py because it relies on the
slowapi @limiter.limit("10/minute") decorator bound to the
server.limiter instance. Moving it here would require the module to
import server at decoration time, which creates a circular import
(server imports this router on startup). The K2 mutation rate-limit
middleware (60/min/IP for all POST/PUT/DELETE) provides a coarser
fallback in addition.
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from app.deps.auth import get_current_user
from app.models import Message, MessageUpdate, User


router = APIRouter(tags=["messages"])


def _get_db():
    """Lazy db accessor — tests swap `server.db` (see conftest.py)."""
    import server
    return server.db


@router.get("/messages/conversations")
async def get_conversations(current_user: User = Depends(get_current_user)):
    """List of conversations with other users plus unread count + last message preview."""
    db = _get_db()
    sent_to = await db.messages.find({"sender_id": current_user.id}).distinct("recipient_id")
    received_from = await db.messages.find({"recipient_id": current_user.id}).distinct("sender_id")
    unique_user_ids = list(set(sent_to + received_from))

    conversations = []
    for user_id in unique_user_ids:
        user = await db.users.find_one({"id": user_id})
        if not user:
            continue

        last_message = await db.messages.find_one(
            {
                "$or": [
                    {"sender_id": current_user.id, "recipient_id": user_id},
                    {"sender_id": user_id, "recipient_id": current_user.id},
                ]
            },
            sort=[("created_at", -1)],
        )
        unread_count = await db.messages.count_documents({
            "sender_id": user_id,
            "recipient_id": current_user.id,
            "is_read": False,
        })
        conversations.append({
            "user_id": user_id,
            "username": user["username"],
            "last_message": last_message.get("message_text") if last_message else None,
            "last_message_time": last_message.get("created_at") if last_message else None,
            "unread_count": unread_count,
        })

    conversations.sort(key=lambda x: x["last_message_time"] or datetime.min, reverse=True)
    return conversations


@router.get("/messages/unread/count")
async def get_unread_count(current_user: User = Depends(get_current_user)):
    """Total unread message count for the current user."""
    db = _get_db()
    count = await db.messages.count_documents({
        "recipient_id": current_user.id,
        "is_read": False,
    })
    return {"unread_count": count}


# IMPORTANT: keep `/messages/{other_user_id}` AFTER the more specific
# `/messages/conversations` and `/messages/unread/count` routes.
# FastAPI matches in declaration order; otherwise these would be swallowed
# by the path-parameter route and resolve as user_ids "conversations"/"unread".
@router.get("/messages/{other_user_id}")
async def get_messages_with_user(
    other_user_id: str,
    limit: int = 50,
    current_user: User = Depends(get_current_user),
):
    """Get all messages between current user and another user; mark inbound as read."""
    db = _get_db()
    messages = await db.messages.find({
        "$or": [
            {"sender_id": current_user.id, "recipient_id": other_user_id},
            {"sender_id": other_user_id, "recipient_id": current_user.id},
        ]
    }).sort("created_at", -1).limit(limit).to_list(limit)

    await db.messages.update_many(
        {
            "sender_id": other_user_id,
            "recipient_id": current_user.id,
            "is_read": False,
        },
        {"$set": {"is_read": True, "updated_at": datetime.now(timezone.utc)}},
    )

    messages.reverse()
    return [Message(**msg) for msg in messages]


@router.put("/messages/{message_id}")
async def update_message(
    message_id: str,
    update_data: MessageUpdate,
    current_user: User = Depends(get_current_user),
):
    """Edit own message text. Sets edited_at timestamp."""
    db = _get_db()
    message = await db.messages.find_one({"id": message_id})
    if not message:
        raise HTTPException(status_code=404, detail="Nachricht nicht gefunden")
    if message.get("sender_id") != current_user.id:
        raise HTTPException(status_code=403, detail="Nur eigene Nachrichten können bearbeitet werden")
    await db.messages.update_one(
        {"id": message_id},
        {"$set": {
            "message_text": update_data.message_text,
            "edited_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        }},
    )
    updated = await db.messages.find_one({"id": message_id})
    return Message(**updated)


@router.delete("/messages/{message_id}")
async def delete_message(
    message_id: str,
    current_user: User = Depends(get_current_user),
):
    """Delete own message."""
    db = _get_db()
    message = await db.messages.find_one({"id": message_id})
    if not message:
        raise HTTPException(status_code=404, detail="Nachricht nicht gefunden")
    if message.get("sender_id") != current_user.id:
        raise HTTPException(status_code=403, detail="Nur eigene Nachrichten können gelöscht werden")
    await db.messages.delete_one({"id": message_id})
    return {"message": "Nachricht gelöscht"}
