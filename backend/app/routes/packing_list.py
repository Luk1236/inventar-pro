"""Packing-list routes — extracted from server.py (Phase 4 refactor).

Endpoints kept verbatim from server.py lines 4294-4457. The check-in
endpoint creates a MaintenanceTask when condition=DEFECT and broadcasts
via the websocket_handler.manager — both behaviors preserved.

The /events/{event_id}/packing-list/sign endpoint at line 4459+ stays
in server.py for now (it's logically a packing-list endpoint but lives
under the /events prefix and is wired into the events flow).
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from app.deps.auth import Permission, get_current_user, require_permission
from app.models import (
    MaintenanceTask,
    PackingListCheckin,
    PackingListCheckout,
    User,
)


router = APIRouter(tags=["packing-list"])


def _get_db():
    """Lazy db accessor — tests swap `server.db` (see conftest.py)."""
    import server
    return server.db


@router.post("/packing-list/checkout")
async def checkout_items(
    checkout: PackingListCheckout,
    current_user: User = Depends(get_current_user),
):
    """Check out multiple items from the packing list."""
    db = _get_db()
    now = datetime.now(timezone.utc)

    updated_count = 0
    for item_id in checkout.item_ids:
        result = await db.packing_list_items.update_one(
            {"id": item_id},
            {"$set": {
                "checked_out": True,
                "checked_out_by": current_user.username,
                "checked_out_at": now,
                "checkout_condition": checkout.condition,
                "checkout_notes": checkout.notes,
            }},
        )
        if result.modified_count > 0:
            updated_count += 1

    if updated_count > 0:
        from websocket_handler import manager
        await manager.broadcast('{"type": "packing_list_updated"}')
    return {"success": True, "updated": updated_count}


@router.post("/packing-list/checkout-all/{event_id}")
async def checkout_all_items(
    event_id: str,
    current_user: User = Depends(get_current_user),
):
    """Check out all items for an event."""
    db = _get_db()
    now = datetime.now(timezone.utc)

    result = await db.packing_list_items.update_many(
        {"event_id": event_id, "checked_out": False},
        {"$set": {
            "checked_out": True,
            "checked_out_by": current_user.username,
            "checked_out_at": now,
            "checkout_condition": "OK",
        }},
    )

    if result.modified_count > 0:
        from websocket_handler import manager
        await manager.broadcast('{"type": "packing_list_updated"}')
    return {"success": True, "updated": result.modified_count}


@router.post("/packing-list/checkin")
async def checkin_item(
    checkin: PackingListCheckin,
    current_user: User = Depends(get_current_user),
):
    """Check in a single item with condition assessment."""
    db = _get_db()
    now = datetime.now(timezone.utc)

    item = await db.packing_list_items.find_one({"id": checkin.item_id})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    update_data = {
        "checked_in": True,
        "checked_in_by": current_user.username,
        "checked_in_at": now,
        "checkin_condition": checkin.condition,
        "checkin_notes": checkin.notes,
        "checkin_photos": checkin.photos,
    }

    await db.packing_list_items.update_one(
        {"id": checkin.item_id},
        {"$set": update_data},
    )

    # F3: Release serial numbers assigned to the booking back to "verfügbar"
    booking_id = item.get("booking_id")
    if booking_id:
        booking = await db.bookings.find_one({"id": booking_id})
        if booking and booking.get("serial_number_ids"):
            await db.serial_numbers.update_many(
                {"id": {"$in": booking["serial_number_ids"]}},
                {"$set": {"status": "verfügbar", "updated_at": datetime.now(timezone.utc).isoformat()}},
            )

    if checkin.condition == "DEFECT":
        article = await db.articles.find_one({"id": item.get("article_id")})
        maintenance_task = MaintenanceTask(
            article_id=item.get("article_id"),
            title=f"Defekt gemeldet: {article.get('name', 'Unbekannt') if article else 'Unbekannt'}",
            description=f"Bei Rückgabe als defekt markiert. Notiz: {checkin.notes or 'Keine'}",
            task_type="Reparatur",
            priority="high",
            status="pending",
            created_by=current_user.username,
        )
        await db.maintenance_tasks.insert_one(maintenance_task.model_dump())

    from websocket_handler import manager
    await manager.broadcast('{"type": "packing_list_updated"}')
    return {"success": True, "condition": checkin.condition}


@router.post("/packing-list/checkin-all/{event_id}")
async def checkin_all_items(
    event_id: str,
    condition: str = "OK",
    current_user: User = Depends(get_current_user),
):
    """Check in all checked-out items as OK."""
    db = _get_db()
    now = datetime.now(timezone.utc)

    result = await db.packing_list_items.update_many(
        {"event_id": event_id, "checked_out": True, "checked_in": False},
        {"$set": {
            "checked_in": True,
            "checked_in_by": current_user.username,
            "checked_in_at": now,
            "checkin_condition": condition,
        }},
    )

    if result.modified_count > 0:
        from websocket_handler import manager
        await manager.broadcast('{"type": "packing_list_updated"}')

    return {"success": True, "updated": result.modified_count}


@router.get("/packing-list/missing/{event_id}")
async def get_missing_items(
    event_id: str,
    current_user: User = Depends(get_current_user),
):
    """Get all items that are checked out but not checked in (potentially missing)."""
    db = _get_db()
    items = await db.packing_list_items.find({
        "event_id": event_id,
        "checked_out": True,
        "checked_in": False,
    }).to_list(1000)

    missing_items = await db.packing_list_items.find({
        "event_id": event_id,
        "checkin_condition": "MISSING",
    }).to_list(1000)

    all_missing_ids = set(i["id"] for i in items) | set(i["id"] for i in missing_items)

    articles = await db.articles.find().to_list(10000)
    article_map = {a["id"]: a for a in articles}

    result = []
    for item in items + missing_items:
        if item["id"] in all_missing_ids:
            all_missing_ids.discard(item["id"])
            article = article_map.get(item.get("article_id"), {})
            result.append({
                **item,
                "article_name": article.get("name", "Unbekannt"),
                "inventory_code": article.get("inventory_code", ""),
            })

    return {
        "event_id": event_id,
        "missing_count": len(result),
        "items": result,
    }


@router.delete("/packing-list/reset/{event_id}")
async def reset_packing_list(
    event_id: str,
    current_user: User = Depends(require_permission(Permission.ADMIN_ACCESS)),
):
    """Reset packing list for an event (admin only)."""
    db = _get_db()
    result = await db.packing_list_items.delete_many({"event_id": event_id})
    return {"success": True, "deleted": result.deleted_count}
