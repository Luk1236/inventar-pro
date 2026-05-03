"""Team routes — extracted from server.py (Phase 4 refactor).

Endpoints kept verbatim from server.py lines 750-823. Pattern matches
suppliers.py / categories.py: lazy `_get_db()` accessor for test
swapability. Uses require_permission(Permission.MANAGE_USERS) for
write operations (create, update, delete, member add/remove).
"""
from typing import List

from fastapi import APIRouter, Depends, HTTPException

from app.deps.auth import Permission, get_current_user, require_permission
from app.models import Team, TeamCreate, User


router = APIRouter(tags=["teams"])


def _get_db():
    """Lazy db accessor — tests swap `server.db` (see conftest.py)."""
    import server
    return server.db


@router.post("/teams", response_model=Team)
async def create_team(
    team_data: TeamCreate,
    current_user: User = Depends(require_permission(Permission.MANAGE_USERS)),
):
    db = _get_db()
    team = Team(**team_data.model_dump(), created_by=current_user.username)
    await db.teams.insert_one(team.model_dump())
    return team


@router.get("/teams", response_model=List[Team])
async def get_teams(current_user: User = Depends(get_current_user)):
    db = _get_db()
    teams = await db.teams.find().to_list(1000)
    return [Team(**team) for team in teams]


@router.get("/teams/{team_id}", response_model=Team)
async def get_team(
    team_id: str,
    current_user: User = Depends(get_current_user),
):
    db = _get_db()
    team = await db.teams.find_one({"id": team_id})
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    return Team(**team)


@router.put("/teams/{team_id}", response_model=Team)
async def update_team(
    team_id: str,
    team_data: TeamCreate,
    current_user: User = Depends(require_permission(Permission.MANAGE_USERS)),
):
    db = _get_db()
    team_dict = team_data.model_dump()
    result = await db.teams.update_one(
        {"id": team_id},
        {"$set": team_dict},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Team not found")
    updated_team = await db.teams.find_one({"id": team_id})
    return Team(**updated_team)


@router.delete("/teams/{team_id}")
async def delete_team(
    team_id: str,
    current_user: User = Depends(require_permission(Permission.MANAGE_USERS)),
):
    db = _get_db()
    result = await db.teams.delete_one({"id": team_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Team not found")
    return {"message": "Team deleted successfully"}


@router.post("/teams/{team_id}/members/{user_id}")
async def add_team_member(
    team_id: str,
    user_id: str,
    current_user: User = Depends(require_permission(Permission.MANAGE_USERS)),
):
    db = _get_db()
    user = await db.users.find_one({"username": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    result = await db.teams.update_one(
        {"id": team_id},
        {"$addToSet": {"members": user_id}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Team not found")
    return {"message": "Member added successfully"}


@router.delete("/teams/{team_id}/members/{user_id}")
async def remove_team_member(
    team_id: str,
    user_id: str,
    current_user: User = Depends(require_permission(Permission.MANAGE_USERS)),
):
    db = _get_db()
    result = await db.teams.update_one(
        {"id": team_id},
        {"$pull": {"members": user_id}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Team not found")
    return {"message": "Member removed successfully"}
