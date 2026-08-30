"""Pydantic schemas for auth endpoints."""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class ProfileCreate(BaseModel):
    username: str = Field(..., min_length=2, max_length=100)
    research_field: str = ""
    focus_areas: list[str] = Field(default_factory=list)


class ProfileRead(BaseModel):
    id: uuid.UUID
    username: str
    research_field: str
    focus_areas: list[str]
    writing_style: str
    api_key_configured: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class ProfileUpdate(BaseModel):
    username: str | None = None
    research_field: str | None = None
    focus_areas: list[str] | None = None
    writing_style: str | None = None
