"""Supplier routes — extracted from server.py (Phase 4 refactor).

Endpoints kept verbatim from server.py lines 800-845. Only changes:
- db is fetched via lazy `_get_db()` accessor (matches vehicles.py pattern,
  lets tests swap `server.db` via conftest.py)
- Pydantic v2: `.model_dump()` (already migrated in server.py prior to extract)
"""
from typing import List

from fastapi import APIRouter, Depends, HTTPException

from app.deps.auth import get_current_user
from app.models import Supplier, SupplierCreate, User


router = APIRouter(tags=["suppliers"])


def _get_db():
    """Lazy db accessor — tests swap `server.db` (see conftest.py)."""
    import server
    return server.db


@router.post("/suppliers", response_model=Supplier)
async def create_supplier(
    supplier_data: SupplierCreate,
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in ("admin", "manager"):
        raise HTTPException(
            status_code=403,
            detail="Keine Berechtigung zum Erstellen von Lieferanten",
        )
    db = _get_db()
    supplier = Supplier(**supplier_data.model_dump())
    await db.suppliers.insert_one(supplier.model_dump())
    return supplier


@router.get("/suppliers", response_model=List[Supplier])
async def get_suppliers(current_user: User = Depends(get_current_user)):
    db = _get_db()
    suppliers = await db.suppliers.find().to_list(1000)
    return [Supplier(**sup) for sup in suppliers]


@router.get("/suppliers/{supplier_id}", response_model=Supplier)
async def get_supplier(
    supplier_id: str,
    current_user: User = Depends(get_current_user),
):
    db = _get_db()
    supplier = await db.suppliers.find_one({"id": supplier_id})
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    return Supplier(**supplier)


@router.put("/suppliers/{supplier_id}", response_model=Supplier)
async def update_supplier(
    supplier_id: str,
    supplier_data: SupplierCreate,
    current_user: User = Depends(get_current_user),
):
    db = _get_db()
    supplier_dict = supplier_data.model_dump()
    result = await db.suppliers.update_one(
        {"id": supplier_id},
        {"$set": supplier_dict},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Supplier not found")
    updated_supplier = await db.suppliers.find_one({"id": supplier_id})
    return Supplier(**updated_supplier)


@router.delete("/suppliers/{supplier_id}")
async def delete_supplier(
    supplier_id: str,
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in ("admin", "manager"):
        raise HTTPException(
            status_code=403,
            detail="Keine Berechtigung zum Löschen von Lieferanten",
        )
    db = _get_db()
    result = await db.suppliers.delete_one({"id": supplier_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Supplier not found")
    return {"message": "Supplier deleted successfully"}
