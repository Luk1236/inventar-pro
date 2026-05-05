"""Customer routes — extracted from server.py (Phase 4 refactor).

Endpoints kept verbatim from server.py lines 2227-2302. Compared to
the simpler suppliers/categories extractions, customers depends on two
helpers that stay in server.py and are imported lazily here:
- `generate_customer_number()` — needs DB and counter logic
- `create_audit_log()` — needs DB and AuditLog model coupling

Soft-delete behavior preserved: DELETE sets `is_active=False` rather
than removing the document, with deleted_at/deleted_by/updated_at
timestamps for the audit trail (V7 contract).
"""
import json
import re
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException

from app.deps.auth import Permission, get_current_user, require_permission
from app.models import Customer, CustomerCreate, User
from websocket_handler import manager


router = APIRouter(tags=["customers"])


def _get_db():
    """Lazy db accessor — tests swap `server.db` (see conftest.py)."""
    import server
    return server.db


def _get_helpers():
    """Lazy import of helpers that stay in server.py."""
    import server
    return server.generate_customer_number, server.create_audit_log


@router.post("/customers", response_model=Customer)
async def create_customer(
    customer_data: CustomerCreate,
    current_user: User = Depends(require_permission(Permission.CREATE_CUSTOMER)),
):
    db = _get_db()
    generate_customer_number, create_audit_log = _get_helpers()
    customer_number = await generate_customer_number()
    customer = Customer(**customer_data.model_dump(), customer_number=customer_number)
    await db.customers.insert_one(customer.model_dump())
    await create_audit_log(
        "CREATE", "customer", current_user, customer.id,
        customer.company_name or customer.contact_name,
        {"new": customer.model_dump()},
    )
    await manager.broadcast(json.dumps({"type": "customer_created", "id": customer.id}))
    return customer


@router.get("/customers", response_model=List[Customer])
async def get_customers(
    search: Optional[str] = None,
    current_user: User = Depends(get_current_user),
):
    db = _get_db()
    query = {"is_active": True}
    if search:
        safe_search = re.escape(search)
        query["$or"] = [
            {"company_name": {"$regex": safe_search, "$options": "i"}},
            {"contact_person": {"$regex": safe_search, "$options": "i"}},
            {"customer_number": {"$regex": safe_search, "$options": "i"}},
            {"email": {"$regex": safe_search, "$options": "i"}},
        ]
    customers = await db.customers.find(query).sort("created_at", -1).to_list(1000)
    return [Customer(**customer) for customer in customers]


@router.get("/customers/{customer_id}", response_model=Customer)
async def get_customer(
    customer_id: str,
    current_user: User = Depends(get_current_user),
):
    db = _get_db()
    customer = await db.customers.find_one({"id": customer_id})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    return Customer(**customer)


@router.put("/customers/{customer_id}", response_model=Customer)
async def update_customer(
    customer_id: str,
    customer_data: CustomerCreate,
    current_user: User = Depends(require_permission(Permission.EDIT_CUSTOMER)),
):
    db = _get_db()
    _, create_audit_log = _get_helpers()
    old_customer = await db.customers.find_one({"id": customer_id})

    customer_dict = customer_data.model_dump()
    customer_dict["updated_at"] = datetime.now(timezone.utc)

    result = await db.customers.update_one(
        {"id": customer_id},
        {"$set": customer_dict},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Customer not found")

    updated_customer = await db.customers.find_one({"id": customer_id})
    await create_audit_log(
        "UPDATE", "customer", current_user, customer_id,
        updated_customer.get("company_name") or updated_customer.get("contact_name"),
        {"old": old_customer, "new": customer_dict},
    )
    await manager.broadcast(json.dumps({"type": "customer_updated", "id": customer_id}))
    return Customer(**updated_customer)


@router.delete("/customers/{customer_id}")
async def delete_customer(
    customer_id: str,
    current_user: User = Depends(require_permission(Permission.EDIT_CUSTOMER)),
):
    db = _get_db()
    _, create_audit_log = _get_helpers()
    customer = await db.customers.find_one({"id": customer_id})
    customer_name = customer.get("company_name") or customer.get("contact_name") if customer else customer_id

    # V7: Soft-delete with audit trail
    result = await db.customers.update_one(
        {"id": customer_id, "is_active": {"$ne": False}},
        {"$set": {
            "is_active": False,
            "deleted_at": datetime.now(timezone.utc).isoformat(),
            "deleted_by": current_user.id,
            "updated_at": datetime.now(timezone.utc),
        }},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Customer not found")
    await create_audit_log(
        "DELETE", "customer", current_user, customer_id, customer_name,
        {"deleted": True},
    )
    await manager.broadcast(json.dumps({"type": "customer_deleted", "id": customer_id}))
    return {"message": "Customer deleted successfully"}
