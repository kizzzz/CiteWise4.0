"""Pydantic schemas for chat endpoints."""

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)
    project_id: str
    session_id: Optional[str] = None
    api_key: Optional[str] = None
    base_url: Optional[str] = None
    model: Optional[str] = None


class SubChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)
    project_id: str
    section_name: str = ""
    content: str = ""
    session_id: Optional[str] = None


class ChatSessionRead(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    title: str
    parent_session_id: Optional[uuid.UUID] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ChatMessageRead(BaseModel):
    id: uuid.UUID
    session_id: uuid.UUID
    role: str
    content: str
    sources: list = Field(default_factory=list)
    agent_data: Optional[dict] = None
    created_at: datetime

    model_config = {"from_attributes": True}
