"""Knowledge map, recommendations, and submit routes."""

import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.deps import get_current_user, get_db
from app.database import SupabaseDB
from app.models.models import Chunk, Paper, Section

router = APIRouter(tags=["knowledge"])


# ─── Knowledge Map ───

@router.get("/map")
async def get_knowledge_map(
    project_id: str,
    user_id: uuid.UUID = Depends(get_current_user),
    db: SupabaseDB = Depends(get_db),
):
    """Build knowledge map: papers as nodes, shared chunks/keywords as edges."""
    papers = await db.select(Paper, project_id=str(project_id))
    if not papers:
        return {"nodes": [], "edges": []}

    nodes = [
        {
            "id": str(p["id"]),
            "label": p.get("title") or p.get("filename") or "未命名",
            "authors": p.get("authors"),
            "year": p.get("year"),
            "chunks": p.get("chunk_count", 0),
        }
        for p in papers
    ]

    # Build edges based on shared chunk section titles
    paper_ids = [p["id"] for p in papers]
    edges = []
    seen_pairs: set[tuple[str, str]] = set()

    # Collect section titles for all papers in one pass
    all_chunks = await db.select(Chunk, project_id=str(project_id))
    titles_by_paper: dict[str, set[str]] = {}
    for ch in all_chunks:
        pid = str(ch["paper_id"])
        title = ch.get("section_title")
        if title:
            titles_by_paper.setdefault(pid, set()).add(title)

    for i, pid1 in enumerate(paper_ids):
        for pid2 in paper_ids[i + 1:]:
            spid1, spid2 = str(pid1), str(pid2)
            titles1 = titles_by_paper.get(spid1, set())
            titles2 = titles_by_paper.get(spid2, set())
            shared = titles1 & titles2
            if shared:
                key = tuple(sorted([spid1, spid2]))
                if key not in seen_pairs:
                    seen_pairs.add(key)
                    edges.append({
                        "source": spid1,
                        "target": spid2,
                        "weight": len(shared),
                        "shared_topics": list(shared)[:5],
                    })

    return {"nodes": nodes, "edges": edges}


# ─── Recommendations ───

class RecommendRequest(BaseModel):
    query: str
    top_k: int = 5


@router.post("/recommend")
async def recommend_papers(
    req: RecommendRequest,
    project_id: str,
    user_id: uuid.UUID = Depends(get_current_user),
    db: SupabaseDB = Depends(get_db),
):
    """Recommend papers from project based on query similarity."""
    from app.core.vector_store import pg_vector_store
    results = await pg_vector_store.vector_search(
        req.query, top_k=req.top_k, project_id=project_id, db=db
    )
    # Group by paper_id
    paper_scores: dict[str, float] = {}
    for r in results:
        pid = r["paper_id"]
        paper_scores[pid] = max(paper_scores.get(pid, 0), 1.0)

    # Fetch paper details
    recommended = []
    for pid in sorted(paper_scores, key=paper_scores.get, reverse=True):
        paper = await db.get(Paper, pid)
        if paper:
            recommended.append({
                "id": str(paper["id"]),
                "title": paper.get("title"),
                "authors": paper.get("authors"),
                "year": paper.get("year"),
                "relevance": paper_scores[pid],
            })
    return recommended


# ─── Submit (Journal Recommendation) ───

class SubmitRequest(BaseModel):
    title: str
    abstract: str
    field: str = ""


@router.post("/submit")
async def recommend_journals(
    req: SubmitRequest,
    user_id: uuid.UUID = Depends(get_current_user),
):
    """Recommend journals and check formatting using LLM."""
    from app.core.llm import llm_client

    messages = [
        {"role": "system", "content": "你是学术期刊推荐专家。根据论文标题和摘要推荐3-5个合适的投稿期刊。只输出JSON。"},
        {"role": "user", "content": f"标题: {req.title}\n摘要: {req.abstract}\n领域: {req.field}\n\n请推荐期刊，JSON格式: {{\"journals\": [{{\"name\": \"期刊名\", \"impact_factor\": \"IF\", \"reason\": \"推荐理由\"}}]}}"},
    ]
    result = await llm_client.achat_json(messages, temperature=0.5)
    return result


@router.post("/format-check")
async def format_check(
    project_id: str,
    user_id: uuid.UUID = Depends(get_current_user),
    db: SupabaseDB = Depends(get_db),
):
    """Check paper formatting issues."""
    from app.core.llm import llm_client

    sections = await db.select(Section, project_id=str(project_id), order="order_index.asc")
    if not sections:
        return {"issues": [], "status": "no_content"}

    full_text = "\n\n".join(f"## {s['title']}\n{s['content']}" for s in sections)
    messages = [
        {"role": "system", "content": "你是论文格式审查专家。检查格式问题。只输出JSON。"},
        {"role": "user", "content": f"请检查以下论文的格式问题:\n{full_text[:4000]}\n\n输出: {{\"issues\": [{{\"type\": \"问题类型\", \"description\": \"描述\", \"location\": \"位置\"}}], \"score\": 0-100}}"},
    ]
    return await llm_client.achat_json(messages, temperature=0.3)
