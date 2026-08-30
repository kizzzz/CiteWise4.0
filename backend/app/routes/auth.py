"""Auth routes — profile management (auth is handled by Supabase client-side)."""

import uuid

from fastapi import APIRouter, Depends, HTTPException

from app.database import SupabaseDB
from app.deps import get_current_user, get_db
from app.models.models import Profile
from app.schemas.auth import ProfileCreate, ProfileRead, ProfileUpdate

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/profile", response_model=ProfileRead)
async def create_profile(
    data: ProfileCreate,
    user_id: uuid.UUID = Depends(get_current_user),
    db: SupabaseDB = Depends(get_db),
):
    """Create a profile for an authenticated Supabase user (called after signup)."""
    existing = await db.get(Profile, user_id)
    if existing:
        raise HTTPException(status_code=409, detail="Profile already exists")
    row = await db.insert(Profile, {"id": str(user_id), **data.model_dump()})
    return row


@router.get("/profile", response_model=ProfileRead)
async def get_profile(
    user_id: uuid.UUID = Depends(get_current_user),
    db: SupabaseDB = Depends(get_db),
):
    """Get the current user's profile."""
    row = await db.get(Profile, user_id)
    if not row:
        raise HTTPException(status_code=404, detail="Profile not found")
    return row


@router.patch("/profile", response_model=ProfileRead)
async def update_profile(
    data: ProfileUpdate,
    user_id: uuid.UUID = Depends(get_current_user),
    db: SupabaseDB = Depends(get_db),
):
    """Update the current user's profile."""
    row = await db.get(Profile, user_id)
    if not row:
        raise HTTPException(status_code=404, detail="Profile not found")
    updated = await db.update(Profile, user_id, data.model_dump(exclude_unset=True))
    return updated
