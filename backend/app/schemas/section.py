"""Pydantic schemas for sections/draft."""

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class SectionCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=500)
    content: str = ""
    order_index: int = 0


class SectionRead(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    title: str
    content: str
    order_index: int
    status: str
    sources: list = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class SectionUpdate(BaseModel):
    title: str | None = None
    content: str | None = None
    order_index: int | None = None
    status: str | None = None


class SectionGenerateRequest(BaseModel):
    section_id: uuid.UUID
    instruction: str = ""
    target_words: int = 1000
    writing_style: str = "学术正式"


class ExportRequest(BaseModel):
    project_id: uuid.UUID
    format: str = "markdown"  # markdown | docx
