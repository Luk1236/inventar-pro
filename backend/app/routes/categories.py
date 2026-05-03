"""Category routes — extracted from server.py (Phase 4 refactor).

Endpoints kept verbatim from server.py lines 744-797. Pattern matches
suppliers.py / vehicles.py: lazy `_get_db()` accessor for test swapability.
"""
from typing import List

from fastapi import APIRouter, Depends, HTTPException

from app.deps.auth import get_current_user
from app.models import Category, User


router = APIRouter(tags=["categories"])


def _get_db():
    """Lazy db accessor — tests swap `server.db` (see conftest.py)."""
    import server
    return server.db


@router.post("/categories", response_model=Category)
async def create_category(
    category: Category,
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in ("admin", "manager"):
        raise HTTPException(
            status_code=403,
            detail="Keine Berechtigung zum Erstellen von Kategorien",
        )
    db = _get_db()
    await db.categories.insert_one(category.model_dump())
    return category


@router.get("/categories", response_model=List[Category])
async def get_categories(current_user: User = Depends(get_current_user)):
    db = _get_db()
    categories = await db.categories.find().to_list(1000)
    return [Category(**cat) for cat in categories]


@router.get("/categories/{category_id}", response_model=Category)
async def get_category(
    category_id: str,
    current_user: User = Depends(get_current_user),
):
    db = _get_db()
    category = await db.categories.find_one({"id": category_id})
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    return Category(**category)


@router.put("/categories/{category_id}", response_model=Category)
async def update_category(
    category_id: str,
    category_data: Category,
    current_user: User = Depends(get_current_user),
):
    db = _get_db()
    category_dict = category_data.model_dump()
    category_dict.pop('id', None)  # Don't update ID
    result = await db.categories.update_one(
        {"id": category_id},
        {"$set": category_dict},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Category not found")
    updated_category = await db.categories.find_one({"id": category_id})
    return Category(**updated_category)


@router.delete("/categories/{category_id}")
async def delete_category(
    category_id: str,
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in ("admin", "manager"):
        raise HTTPException(
            status_code=403,
            detail="Keine Berechtigung zum Löschen von Kategorien",
        )
    db = _get_db()
    articles_using_category = await db.articles.count_documents({"category_id": category_id})
    if articles_using_category > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Category is used by {articles_using_category} article(s). Please reassign or delete them first.",
        )
    result = await db.categories.delete_one({"id": category_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Category not found")
    return {"message": "Category deleted successfully"}
