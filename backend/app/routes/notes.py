"""Quick notes CRUD routes."""

import uuid

from fastapi import APIRouter, Depends, HTTPException

from app.deps import get_current_user, get_db
from app.database import SupabaseDB
from app.models.models import NoteType, QuickNote
from pydantic import BaseModel, Field

router = APIRouter(tags=["notes"])


class NoteCreate(BaseModel):
    content: str = Field(..., min_length=1)
    note_type_id: uuid.UUID | None = None
    is_pinned: bool = False


class NoteUpdate(BaseModel):
    content: str | None = None
    note_type_id: uuid.UUID | None = None
    is_pinned: bool | None = None
    ai_category: str | None = None
    merged_into_id: uuid.UUID | None = None


class NoteTypeCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    color: str = "#6366f1"
    icon: str = "note"


@router.get("/")
async def list_notes(
    project_id: str,
    user_id: uuid.UUID = Depends(get_current_user),
    db: SupabaseDB = Depends(get_db),
):
    notes = await db.select_raw("quick_notes", {
        "project_id": f"eq.{project_id}",
        "order": "is_pinned.desc,created_at.desc",
        "select": "id,content,note_type_id,is_pinned,ai_category,merged_into_id,created_at",
    })
    return [
        {
            "id": str(n["id"]),
            "content": n["content"],
            "note_type_id": str(n["note_type_id"]) if n.get("note_type_id") else None,
            "is_pinned": n["is_pinned"],
            "ai_category": n.get("ai_category"),
            "merged_into_id": str(n["merged_into_id"]) if n.get("merged_into_id") else None,
            "created_at": n["created_at"] if isinstance(n["created_at"], str) else n["created_at"].isoformat(),
        }
        for n in notes
    ]


@router.post("/")
async def create_note(
    data: NoteCreate,
    project_id: str,
    user_id: uuid.UUID = Depends(get_current_user),
    db: SupabaseDB = Depends(get_db),
):
    payload = {
        "project_id": str(project_id),
        "user_id": str(user_id),
        **data.model_dump(),
    }
    if payload.get("note_type_id") is not None:
        payload["note_type_id"] = str(payload["note_type_id"])
    row = await db.insert(QuickNote, payload)
    return {"id": str(row["id"]), "content": row["content"], "is_pinned": row["is_pinned"]}


@router.patch("/{note_id}")
async def update_note(
    note_id: uuid.UUID,
    data: NoteUpdate,
    user_id: uuid.UUID = Depends(get_current_user),
    db: SupabaseDB = Depends(get_db),
):
    note = await db.get(QuickNote, str(note_id))
    if not note:
        raise HTTPException(status_code=404)
    update_data = data.model_dump(exclude_unset=True)
    if "note_type_id" in update_data and update_data["note_type_id"] is not None:
        update_data["note_type_id"] = str(update_data["note_type_id"])
    if "merged_into_id" in update_data and update_data["merged_into_id"] is not None:
        update_data["merged_into_id"] = str(update_data["merged_into_id"])
    await db.update(QuickNote, str(note_id), update_data)
    return {"status": "ok"}


@router.delete("/{note_id}", status_code=204)
async def delete_note(
    note_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user),
    db: SupabaseDB = Depends(get_db),
):
    await db.delete(QuickNote, str(note_id))


# Note Types
@router.get("/types")
async def list_note_types(
    user_id: uuid.UUID = Depends(get_current_user),
    db: SupabaseDB = Depends(get_db),
):
    types = await db.select(NoteType, user_id=str(user_id))
    return [{"id": str(t["id"]), "name": t["name"], "color": t["color"], "icon": t["icon"]} for t in types]


@router.post("/types")
async def create_note_type(
    data: NoteTypeCreate,
    user_id: uuid.UUID = Depends(get_current_user),
    db: SupabaseDB = Depends(get_db),
):
    row = await db.insert(NoteType, {"user_id": str(user_id), **data.model_dump()})
    return {"id": str(row["id"]), "name": row["name"]}
