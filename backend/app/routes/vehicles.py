"""Vehicle routes — extracted from server.py (Phase 4 refactor).

Canonical endpoints are what was registered first in server.py via
`@api_router.*("/vehicles")` (lines 7270-7319 pre-refactor). A second
block under `@app.*("/api/vehicles")` with divergent implementations
(`{"_id": vehicle_id}` queries, different response shapes) existed at
lines 8149-8181 but was dead code: FastAPI matched the api_router
routes first, and the @app block never executed — the duplicate only
surfaced as a "Duplicate Operation ID" warning in OpenAPI schema
generation. The dead-code block is removed by this refactor.

Tests (backend/tests/test_vehicles.py) confirm the Set-A contract:
- PUT → `{"status": "success"}` (Set A shape, not Set B's `{"id": ...}`)
- DELETE → `{"status": "deleted"}` (Set A shape, not Set B's `{"message": ...}`)
"""
from datetime import datetime, timezone
import uuid as uuid_module

from fastapi import APIRouter, Depends, HTTPException

from app.deps.auth import get_current_user
from app.models import User, VehicleCreate


router = APIRouter(tags=["vehicles"])


def _get_db():
    """Lazy db accessor — tests swap `server.db` (see conftest.py)."""
    import server
    return server.db


@router.get("/vehicles")
async def get_vehicles(current_user: User = Depends(get_current_user)):
    """Get all vehicles."""
    db = _get_db()
    vehicles = await db.vehicles.find().sort("name", 1).to_list(100)
    for vehicle in vehicles:
        vehicle.pop("_id", None)
    return vehicles


@router.post("/vehicles")
async def create_vehicle(
    vehicle_data: VehicleCreate,
    current_user: User = Depends(get_current_user),
):
    """Create a new vehicle."""
    db = _get_db()
    try:
        doc = vehicle_data.model_dump()
        doc["id"] = str(uuid_module.uuid4())
        doc["_id"] = doc["id"]
        doc["created_at"] = datetime.now(timezone.utc).isoformat()
        await db.vehicles.insert_one(doc)
        return doc
    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Interner Serverfehler. Details wurden protokolliert.",
        )


@router.put("/vehicles/{vehicle_id}")
async def update_vehicle(
    vehicle_id: str,
    update_data: dict,
    current_user: User = Depends(get_current_user),
):
    """Update a vehicle."""
    db = _get_db()
    result = await db.vehicles.update_one(
        {"id": vehicle_id},
        {"$set": update_data},
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Fahrzeug nicht gefunden")
    return {"status": "success"}


@router.delete("/vehicles/{vehicle_id}")
async def delete_vehicle(
    vehicle_id: str,
    current_user: User = Depends(get_current_user),
):
    """Delete a vehicle."""
    db = _get_db()
    result = await db.vehicles.delete_one({"id": vehicle_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Fahrzeug nicht gefunden")
    return {"status": "deleted"}
