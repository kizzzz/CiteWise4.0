"""Pydantic schemas for paper endpoints."""

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class PaperRead(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    title: Optional[str] = None
    authors: Optional[str] = None
    year: Optional[int] = None
    filename: Optional[str] = None
    chunk_count: int = 0
    raw_text: str = ""
    sections_json: list = Field(default_factory=list)
    metadata_: dict = Field(default_factory=dict, validation_alias="metadata_")
    indexed_at: datetime

    model_config = {"from_attributes": True, "populate_by_name": True}


class PaperDetail(PaperRead):
    """Paper with computed fields for detail view."""
    abstract: str = ""
    sections: list[dict] = Field(default_factory=list)
    full_text: str = ""


class PaperTitleUpdate(BaseModel):
    title: str = Field(..., min_length=1, max_length=500)


class UploadProgress(BaseModel):
    phase: str  # uploading, parsing, indexing, done
    file: Optional[str] = None
    current: int = 0
    total: int = 0
    chunks: int = 0
    message: Optional[str] = None
