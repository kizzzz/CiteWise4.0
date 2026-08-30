"""Paper upload and management routes."""

import asyncio
import json
import logging
import os
import uuid

from fastapi import APIRouter, Depends, Form, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse

from app.deps import get_current_user, get_db, verify_project_owner
from app.database import SupabaseDB
from app.core.file_parser import chunk_paper, get_file_extension, is_supported, parse_file
from app.core.vector_store import pg_vector_store
from app.models.models import Paper
from app.schemas.paper import PaperDetail, PaperRead, PaperTitleUpdate
from app.services import paper_service

logger = logging.getLogger(__name__)

router = APIRouter(tags=["papers"])

MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB


async def _get_owned_paper(db: SupabaseDB, paper_id: uuid.UUID, user_id: uuid.UUID) -> dict:
    paper = await db.get(Paper, str(paper_id))
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")
    await verify_project_owner(db, paper["project_id"], user_id)
    return paper


@router.get("/", response_model=list[PaperRead])
async def list_papers(
    project_id: str,
    user_id: uuid.UUID = Depends(get_current_user),
    db: SupabaseDB = Depends(get_db),
):
    await verify_project_owner(db, project_id, user_id)
    rows = await db.select(
        Paper,
        project_id=str(uuid.UUID(project_id)),
        order="indexed_at.desc",
    )
    for r in rows:
        if isinstance(r.get("sections_json"), str):
            try:
                r["sections_json"] = json.loads(r["sections_json"])
            except (ValueError, TypeError):
                r["sections_json"] = []
    return rows


@router.get("/{paper_id}")
async def get_paper(
    paper_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user),
    db: SupabaseDB = Depends(get_db),
):
    await _get_owned_paper(db, paper_id, user_id)
    detail = await paper_service.get_paper_detail(db, paper_id)
    if not detail:
        raise HTTPException(status_code=404, detail="Paper not found")
    return detail


@router.post("/upload")
async def upload_papers(
    files: list[UploadFile] = File(...),
    project_id: str = Form(...),
    user_id: uuid.UUID = Depends(get_current_user),
    db: SupabaseDB = Depends(get_db),
):
    """Upload papers — JSON response."""
    await verify_project_owner(db, project_id, user_id)
    result = await _process_uploads(files, project_id, db)
    return result


@router.post("/upload/stream")
async def upload_papers_stream(
    files: list[UploadFile] = File(...),
    project_id: str = Form(...),
    user_id: uuid.UUID = Depends(get_current_user),
    db: SupabaseDB = Depends(get_db),
):
    """Upload papers — SSE streaming progress."""
    async def progress_generator():
        total = len(files)
        all_chunks_data: list[dict] = []
        processed = 0

        yield f"data: {json.dumps({'phase': 'uploading', 'total': total, 'current': 0}, ensure_ascii=False)}\n\n"

        for idx, f in enumerate(files):
            original_name = os.path.basename(f.filename or "unknown")
            if not is_supported(original_name):
                yield f"data: {json.dumps({'phase': 'warning', 'file': original_name, 'error': '不支持的文件格式'}, ensure_ascii=False)}\n\n"
                continue

            content = await f.read()
            if len(content) > MAX_FILE_SIZE:
                yield f"data: {json.dumps({'phase': 'warning', 'file': original_name, 'error': 'File exceeds 50MB'}, ensure_ascii=False)}\n\n"
                continue

            safe_name = paper_service.save_upload_file(content, original_name)
            filepath = os.path.join(paper_service.UPLOAD_DIR, safe_name)

            yield f"data: {json.dumps({'phase': 'parsing', 'file': original_name, 'current': idx + 1, 'total': total}, ensure_ascii=False)}\n\n"

            try:
                data = await asyncio.to_thread(parse_file, filepath, original_name)
                data["paper_id"] = str(uuid.uuid4())  # New UUID for DB
                data["project_id"] = project_id
                chunks = await asyncio.to_thread(chunk_paper, data)

                await paper_service.create_paper_record(
                    db, uuid.UUID(project_id), data, len(chunks), safe_name
                )
                await paper_service.create_figure_records(db, data, uuid.UUID(project_id))

                all_chunks_data.extend(chunks)
                processed += 1

                yield f"data: {json.dumps({'phase': 'parsed', 'file': original_name, 'chunks': len(chunks), 'current': idx + 1, 'total': total}, ensure_ascii=False)}\n\n"

            except Exception as e:
                logger.error(f"Parse {original_name} failed: {e}", exc_info=True)
                yield f"data: {json.dumps({'phase': 'warning', 'file': original_name, 'error': '解析失败'}, ensure_ascii=False)}\n\n"

        if all_chunks_data:
            yield f"data: {json.dumps({'phase': 'indexing', 'chunks': len(all_chunks_data)}, ensure_ascii=False)}\n\n"
            await pg_vector_store.index_chunks(all_chunks_data, db)

        yield f"data: {json.dumps({'phase': 'done', 'message': f'已入库 {processed} 篇论文，{len(all_chunks_data)} 个片段', 'papers_count': processed, 'chunks_count': len(all_chunks_data)}, ensure_ascii=False)}\n\n"

    return StreamingResponse(
        progress_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.delete("/{paper_id}")
async def delete_paper(
    paper_id: uuid.UUID,
    project_id: str = "",
    user_id: uuid.UUID = Depends(get_current_user),
    db: SupabaseDB = Depends(get_db),
):
    await _get_owned_paper(db, paper_id, user_id)
    await pg_vector_store.delete_by_paper(str(paper_id), db)
    deleted = await paper_service.delete_paper_cascade(db, paper_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Paper not found")
    return {"status": "ok"}


@router.patch("/{paper_id}/title")
async def update_paper_title(
    paper_id: uuid.UUID,
    body: PaperTitleUpdate,
    user_id: uuid.UUID = Depends(get_current_user),
    db: SupabaseDB = Depends(get_db),
):
    await _get_owned_paper(db, paper_id, user_id)
    updated = await db.update(Paper, str(paper_id), {"title": body.title.strip()})
    return {"status": "ok", "title": updated.get("title", body.title.strip())}


async def _process_uploads(files: list[UploadFile], project_id: str, db: SupabaseDB) -> dict:
    all_chunks_data: list[dict] = []
    processed = 0

    for f in files:
        original_name = os.path.basename(f.filename or "unknown")
        if not is_supported(original_name):
            continue
        content = await f.read()
        if len(content) > MAX_FILE_SIZE:
            continue

        safe_name = paper_service.save_upload_file(content, original_name)
        filepath = os.path.join(paper_service.UPLOAD_DIR, safe_name)

        try:
            data = await asyncio.to_thread(parse_file, filepath, original_name)
            data["paper_id"] = str(uuid.uuid4())
            data["project_id"] = project_id
            chunks = await asyncio.to_thread(chunk_paper, data)

            await paper_service.create_paper_record(db, uuid.UUID(project_id), data, len(chunks), safe_name)
            await paper_service.create_figure_records(db, data, uuid.UUID(project_id))
            all_chunks_data.extend(chunks)
            processed += 1
        except Exception as e:
            logger.error(f"Parse {safe_name} failed: {e}")

    if all_chunks_data:
        await pg_vector_store.index_chunks(all_chunks_data, db)

    return {
        "message": f"已入库 {processed} 篇论文，{len(all_chunks_data)} 个片段",
        "chunks_count": len(all_chunks_data),
        "papers_count": processed,
    }
