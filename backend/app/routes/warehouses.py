"""Multi-Lager (Warehouse) CRUD-Endpoints."""
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Body
from app.database import db
from app.models import Warehouse, WarehouseCreate
from app.deps.auth import get_current_user

router = APIRouter(prefix="/warehouses", tags=["warehouses"])


def _serialize(w: dict) -> dict:
    w.pop("_id", None)
    return w


@router.get("")
async def list_warehouses(include_archived: bool = False, current_user=Depends(get_current_user)):
    q = {} if include_archived else {"archived": {"$ne": True}}
    items = await db.warehouses.find(q).sort("name", 1).to_list(1000)
    return [_serialize(w) for w in items]


@router.post("")
async def create_warehouse(payload: WarehouseCreate, current_user=Depends(get_current_user)):
    w = Warehouse(**payload.model_dump())
    if w.is_default:
        await db.warehouses.update_many({}, {"$set": {"is_default": False}})
    await db.warehouses.insert_one(w.model_dump())
    return _serialize(w.model_dump())


@router.get("/{warehouse_id}")
async def get_warehouse(warehouse_id: str, current_user=Depends(get_current_user)):
    w = await db.warehouses.find_one({"id": warehouse_id})
    if not w:
        raise HTTPException(404, "Lager nicht gefunden")
    return _serialize(w)


@router.put("/{warehouse_id}")
async def update_warehouse(warehouse_id: str, payload: dict = Body(...), current_user=Depends(get_current_user)):
    payload = {k: v for k, v in payload.items() if k not in ("id", "_id", "created_at")}
    payload["updated_at"] = datetime.now(timezone.utc)
    if payload.get("is_default"):
        await db.warehouses.update_many({"id": {"$ne": warehouse_id}}, {"$set": {"is_default": False}})
    res = await db.warehouses.update_one({"id": warehouse_id}, {"$set": payload})
    if res.matched_count == 0:
        raise HTTPException(404, "Lager nicht gefunden")
    w = await db.warehouses.find_one({"id": warehouse_id})
    return _serialize(w)


@router.delete("/{warehouse_id}")
async def delete_warehouse(warehouse_id: str, current_user=Depends(get_current_user)):
    count = await db.articles.count_documents({"warehouse_id": warehouse_id})
    if count > 0:
        await db.warehouses.update_one({"id": warehouse_id}, {"$set": {"archived": True}})
        return {"ok": True, "msg": f"Lager archiviert ({count} Artikel sind zugeordnet)"}
    res = await db.warehouses.delete_one({"id": warehouse_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Lager nicht gefunden")
    return {"ok": True, "msg": "Lager gelöscht"}


@router.get("/{warehouse_id}/stats")
async def warehouse_stats(warehouse_id: str, current_user=Depends(get_current_user)):
    w = await db.warehouses.find_one({"id": warehouse_id})
    if not w:
        raise HTTPException(404, "Lager nicht gefunden")
    total = await db.articles.count_documents({"warehouse_id": warehouse_id, "archived": {"$ne": True}})
    pipeline = [
        {"$match": {"warehouse_id": warehouse_id, "archived": {"$ne": True}}},
        {"$group": {
            "_id": None,
            "total_stock": {"$sum": {"$ifNull": ["$current_stock", 0]}},
            "total_value": {"$sum": {"$multiply": [
                {"$ifNull": ["$current_stock", 0]},
                {"$ifNull": ["$price_per_unit", 0]},
            ]}},
        }},
    ]
    agg = await db.articles.aggregate(pipeline).to_list(1)
    stats = agg[0] if agg else {"total_stock": 0, "total_value": 0}
    return {
        "warehouse_id": warehouse_id,
        "name": w.get("name"),
        "article_count": total,
        "total_stock": stats.get("total_stock", 0),
        "total_value": round(stats.get("total_value", 0) or 0, 2),
    }
