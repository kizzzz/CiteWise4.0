"""Chat routes — SSE streaming via LangGraph."""

import json
import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse

from app.database import SupabaseDB
from app.deps import get_current_user, get_db, verify_project_owner
from app.models.models import ChatMessage, ChatSession
from app.schemas.chat import ChatRequest, SubChatRequest

logger = logging.getLogger(__name__)
router = APIRouter(tags=["chat"])


@router.post("/chat")
async def chat_endpoint(
    req: ChatRequest,
    user_id: uuid.UUID = Depends(get_current_user),
    db: SupabaseDB = Depends(get_db),
):
    """Main chat — SSE streaming with agent events."""

    await verify_project_owner(db, req.project_id, user_id)

    session_id = req.session_id
    if session_id:
        session = await db.get(ChatSession, uuid.UUID(session_id))
        if not session or str(session.get("user_id")) != str(user_id):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
        if str(session.get("project_id")) != str(uuid.UUID(req.project_id)):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Session does not belong to this project")
        session_id = str(session["id"])

    async def event_generator():
        nonlocal session_id
        try:
            from app.graph.graph import get_graph

            if not session_id:
                title = req.message.strip().replace("\n", " ")[:50] or "新对话"
                row = await db.insert(ChatSession, {
                    "project_id": str(uuid.UUID(req.project_id)),
                    "user_id": str(user_id),
                    "title": title,
                })
                session_id = str(row["id"])
                yield f"event: session\ndata: {json.dumps({'session_id': session_id}, ensure_ascii=False)}\n\n"

            await db.insert(ChatMessage, {
                "session_id": session_id,
                "role": "user",
                "content": req.message,
                "sources": [],
            })

            graph = get_graph()
            config = {"configurable": {"thread_id": session_id}}

            state_input = {
                "user_input": req.message,
                "project_id": req.project_id,
                "session_id": session_id,
                "messages": [],
            }

            chain_content = ""
            token_content = ""
            final_sources: list = []
            async for event in graph.astream_events(state_input, config, version="v2"):
                kind = event.get("event")
                if kind == "on_chain_end":
                    output = event.get("data", {}).get("output", {})
                    if isinstance(output, dict):
                        agent_events = output.get("agent_events", [])
                        for ae in agent_events:
                            yield f"event: agent_{ae.get('event', 'update')}\ndata: {json.dumps(ae, ensure_ascii=False, default=str)}\n\n"

                        content = output.get("content", "")
                        if content:
                            chain_content = content
                            yield f"event: content\ndata: {json.dumps({'content': content}, ensure_ascii=False)}\n\n"

                        sources = output.get("sources", [])
                        if sources:
                            final_sources = sources
                            yield f"event: sources\ndata: {json.dumps({'sources': sources}, ensure_ascii=False)}\n\n"

                elif kind == "on_chat_model_stream":
                    chunk = event.get("data", {}).get("chunk")
                    if chunk and chunk.content:
                        token_content += chunk.content
                        yield f"event: token\ndata: {json.dumps({'token': chunk.content}, ensure_ascii=False)}\n\n"

            # The frontend displays the last on_chain_end content when present
            # (it replaces accumulated tokens), so persist the same thing.
            persisted_content = chain_content or token_content
            if persisted_content:
                await db.insert(ChatMessage, {
                    "session_id": session_id,
                    "role": "assistant",
                    "content": persisted_content,
                    "sources": final_sources,
                })

            yield f"event: done\ndata: {json.dumps({'message': '完成'}, ensure_ascii=False)}\n\n"

        except Exception as e:
            logger.error(f"Chat error: {e}", exc_info=True)
            yield f"event: error\ndata: {json.dumps({'message': '处理请求时发生错误'}, ensure_ascii=False)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/chat/sub")
async def sub_chat_endpoint(
    req: SubChatRequest,
    user_id: uuid.UUID = Depends(get_current_user),
    db: SupabaseDB = Depends(get_db),
):
    """Sub-chat for section-level editing."""
    from app.core.llm import llm_client
    from app.core.prompt import SYSTEM_PROMPT_BASE

    augmented = (
        f"用户正在撰写论文的「{req.section_name}」章节。\n\n"
        f"当前章节内容：\n{req.content[:3000]}\n\n"
        f"用户最新指令：{req.message}\n\n"
        f"请根据用户指令对「{req.section_name}」章节进行操作。直接输出修改后的内容。"
    )
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT_BASE},
        {"role": "user", "content": augmented},
    ]
    content = await llm_client.achat(messages, temperature=0.5)
    return {"content": content, "type": "text"}


@router.get("/sessions")
async def list_sessions(
    project_id: str,
    user_id: uuid.UUID = Depends(get_current_user),
    db: SupabaseDB = Depends(get_db),
):
    await verify_project_owner(db, project_id, user_id)
    rows = await db.select(
        ChatSession,
        order="created_at.desc",
        limit=50,
        project_id=str(uuid.UUID(project_id)),
    )
    return [
        {
            "id": str(r["id"]),
            "title": r["title"],
            "parent_session_id": str(r["parent_session_id"]) if r.get("parent_session_id") else None,
            "created_at": r["created_at"],
        }
        for r in rows
    ]


@router.post("/sessions")
async def create_session(
    project_id: str,
    title: str = "新对话",
    user_id: uuid.UUID = Depends(get_current_user),
    db: SupabaseDB = Depends(get_db),
):
    await verify_project_owner(db, project_id, user_id)
    row = await db.insert(ChatSession, {
        "project_id": str(uuid.UUID(project_id)),
        "user_id": str(user_id),
        "title": title,
    })
    return {"session_id": str(row["id"])}


async def _get_owned_session(
    db: SupabaseDB, session_id: str, user_id: uuid.UUID
) -> dict:
    session = await db.get(ChatSession, uuid.UUID(session_id))
    if not session or str(session.get("user_id")) != str(user_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    return session


@router.get("/sessions/{session_id}/messages")
async def get_session_messages(
    session_id: str,
    limit: int = 20,
    user_id: uuid.UUID = Depends(get_current_user),
    db: SupabaseDB = Depends(get_db),
):
    await _get_owned_session(db, session_id, user_id)
    rows = await db.select(
        ChatMessage,
        order="created_at.desc",
        limit=limit,
        session_id=str(uuid.UUID(session_id)),
    )
    return [
        {
            "id": str(m["id"]),
            "role": m["role"],
            "content": m["content"],
            "sources": m.get("sources", []),
            "agent_data": m.get("agent_data"),
            "created_at": m["created_at"],
        }
        for m in reversed(rows)
    ]


@router.delete("/sessions/{session_id}")
async def delete_session(
    session_id: str,
    user_id: uuid.UUID = Depends(get_current_user),
    db: SupabaseDB = Depends(get_db),
):
    await _get_owned_session(db, session_id, user_id)
    await db.delete(ChatSession, str(uuid.UUID(session_id)))
    return {"status": "ok"}


@router.patch("/sessions/{session_id}")
async def rename_session(
    session_id: str,
    title: str,
    user_id: uuid.UUID = Depends(get_current_user),
    db: SupabaseDB = Depends(get_db),
):
    await _get_owned_session(db, session_id, user_id)
    await db.update(ChatSession, session_id, {"title": title.strip()[:500] or "未命名对话"})
    return {"status": "ok"}
