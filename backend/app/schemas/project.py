"""Pydantic schemas for project endpoints."""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class ProjectCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    topic: str = ""
    config: dict = Field(default_factory=dict)


class ProjectRead(BaseModel):
    id: uuid.UUID
    name: str
    topic: str
    status: str
    config: dict
    created_at: datetime

    model_config = {"from_attributes": True}


class ProjectUpdate(BaseModel):
    name: str | None = None
    topic: str | None = None
    status: str | None = None
    config: dict | None = None
