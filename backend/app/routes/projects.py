"""Project CRUD routes."""

import uuid

from fastapi import APIRouter, Depends, HTTPException

from app.database import SupabaseDB
from app.deps import get_current_user, get_db
from app.models.models import Project
from app.schemas.project import ProjectCreate, ProjectRead, ProjectUpdate

router = APIRouter(prefix="/projects", tags=["projects"])


@router.post("/", response_model=ProjectRead)
async def create_project(
    data: ProjectCreate,
    user_id: uuid.UUID = Depends(get_current_user),
    db: SupabaseDB = Depends(get_db),
):
    row = await db.insert(Project, {"user_id": str(user_id), **data.model_dump()})
    return row


@router.get("/", response_model=list[ProjectRead])
async def list_projects(
    user_id: uuid.UUID = Depends(get_current_user),
    db: SupabaseDB = Depends(get_db),
):
    rows = await db.select(Project, order="created_at.desc", user_id=str(user_id))
    return rows


@router.get("/{project_id}", response_model=ProjectRead)
async def get_project(
    project_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user),
    db: SupabaseDB = Depends(get_db),
):
    row = await db.get(Project, project_id)
    if not row or row.get("user_id") != str(user_id):
        raise HTTPException(status_code=404, detail="Project not found")
    return row


@router.patch("/{project_id}", response_model=ProjectRead)
async def update_project(
    project_id: uuid.UUID,
    data: ProjectUpdate,
    user_id: uuid.UUID = Depends(get_current_user),
    db: SupabaseDB = Depends(get_db),
):
    row = await db.get(Project, project_id)
    if not row or row.get("user_id") != str(user_id):
        raise HTTPException(status_code=404, detail="Project not found")
    updated = await db.update(Project, project_id, data.model_dump(exclude_unset=True))
    return updated


@router.delete("/{project_id}", status_code=204)
async def delete_project(
    project_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user),
    db: SupabaseDB = Depends(get_db),
):
    row = await db.get(Project, project_id)
    if not row or row.get("user_id") != str(user_id):
        raise HTTPException(status_code=404, detail="Project not found")
    await db.delete(Project, project_id)
