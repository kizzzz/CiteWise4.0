"""Paper business logic service."""

import json
import logging
import os
import uuid
from typing import Optional

from app.database import SupabaseDB
from app.models.models import Chunk, Figure, Paper

logger = logging.getLogger(__name__)

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)


async def create_paper_record(
    db: SupabaseDB,
    project_id: uuid.UUID,
    paper_data: dict,
    chunks_count: int,
    safe_filename: str,
) -> dict:
    """Create a Paper record via REST API."""
    row = {
        "id": str(uuid.UUID(paper_data["paper_id"])),
        "project_id": str(project_id),
        "title": paper_data.get("title", ""),
        "authors": paper_data.get("authors", ""),
        "year": paper_data.get("year"),
        "filename": safe_filename,
        "chunk_count": chunks_count,
        "raw_text": paper_data.get("raw_text", ""),
        "sections_json": json.dumps(paper_data.get("sections", [])),
        "metadata": json.dumps({
            "page_count": paper_data.get("page_count", 0),
        }),
    }
    return await db.insert(Paper, row)


async def create_figure_records(db: SupabaseDB, paper_data: dict, project_id: uuid.UUID):
    """Create Figure records from parsed data via REST API."""
    for fig in paper_data.get("figures", []):
        row = {
            "id": str(uuid.uuid4()),
            "paper_id": str(uuid.UUID(paper_data["paper_id"])),
            "figure_type": "chart",
            "title": fig.get("caption", ""),
            "data_json": json.dumps({
                "page": fig.get("page"),
                "width": fig.get("width"),
                "height": fig.get("height"),
            }),
            "page_number": fig.get("page"),
        }
        await db.insert(Figure, row)


async def get_paper_detail(db: SupabaseDB, paper_id: uuid.UUID) -> Optional[dict]:
    """Get paper with computed sections for detail view."""
    paper = await db.get(Paper, str(paper_id))
    if not paper:
        return None

    sections_json = paper.get("sections_json", [])
    if isinstance(sections_json, str):
        try:
            sections_json = json.loads(sections_json)
        except (json.JSONDecodeError, TypeError):
            sections_json = []

    has_content = any(s.get("text", "").strip() for s in sections_json)

    if has_content:
        sections = [
            {"title": s.get("title", "全文"), "level": "L1", "text": s.get("text", "")}
            for s in sections_json
        ]
    else:
        # Fallback: query chunks via REST API
        chunks = await db.select(
            Chunk,
            paper_id=str(paper_id),
            order="section_title.asc",
        )
        sections = [
            {"title": c.get("section_title", ""), "level": "L2", "text": c.get("content", "")}
            for c in chunks
        ]

    abstract = ""
    for s in sections:
        if s.get("level") == "L0":
            abstract = s["text"]
            break

    raw_text = paper.get("raw_text", "")
    indexed_at = paper.get("indexed_at")

    return {
        "id": paper.get("id"),
        "project_id": paper.get("project_id"),
        "title": paper.get("title"),
        "authors": paper.get("authors"),
        "year": paper.get("year"),
        "filename": paper.get("filename"),
        "chunk_count": paper.get("chunk_count", 0),
        "abstract": abstract or (raw_text[:500] if raw_text else "暂无内容"),
        "sections": sections,
        "full_text": raw_text or "\n\n".join(s.get("text", "") for s in sections),
        "indexed_at": indexed_at.isoformat() if hasattr(indexed_at, "isoformat") else str(indexed_at) if indexed_at else None,
    }


async def delete_paper_cascade(db: SupabaseDB, paper_id: uuid.UUID):
    """Delete a paper and all its chunks/figures via REST API."""
    paper = await db.get(Paper, str(paper_id))
    if not paper:
        return False

    # Delete related chunks first
    await db.delete_by(Chunk, paper_id=str(paper_id))
    # Delete related figures
    await db.delete_by(Figure, paper_id=str(paper_id))
    # Delete the paper itself
    await db.delete(Paper, str(paper_id))
    return True


def save_upload_file(content: bytes, original_filename: str) -> str:
    """Save uploaded file to disk, return safe filename."""
    ext = os.path.splitext(original_filename)[1].lower()
    safe_name = f"{uuid.uuid4().hex}{ext}"
    path = os.path.join(UPLOAD_DIR, safe_name)
    with open(path, "wb") as f:
        f.write(content)
    return safe_name
