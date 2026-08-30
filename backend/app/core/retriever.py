"""Hybrid retriever — pgvector + tsvector + RRF fusion."""
import logging
from typing import Optional

from app.core.vector_store import pg_vector_store
from app.core.bm25_store import ts_vector_search
from app.database import SupabaseDB

logger = logging.getLogger(__name__)

RRF_K = 60


def reciprocal_rank_fusion(vector_results: list[dict], bm25_results: list[dict],
                           k: int = RRF_K) -> list[str]:
    scores: dict[str, float] = {}
    for rank, doc in enumerate(vector_results):
        doc_id = doc["chunk_id"]
        scores[doc_id] = scores.get(doc_id, 0) + 1.0 / (k + rank + 1)
    for rank, doc in enumerate(bm25_results):
        doc_id = doc["chunk_id"]
        scores[doc_id] = scores.get(doc_id, 0) + 1.0 / (k + rank + 1)
    ranked = sorted(scores.items(), key=lambda x: x[1], reverse=True)
    return [doc_id for doc_id, _ in ranked]


async def hybrid_search(query: str, top_k: int = 5, project_id: str = None,
                        intent: str = "explore", db: SupabaseDB = None) -> list[dict]:
    """Hybrid search with optional Redis cache."""
    if not db:
        return []

    # Check cache
    try:
        from app.core.cache import query_cache
        cached = await query_cache.get(query, project_id or "")
        if cached is not None:
            logger.info(f"Query cache hit: '{query[:30]}...'")
            return cached[:top_k]
    except Exception:
        pass

    vector_top_k = 20 if intent in ("generate", "modify") else 15
    bm25_top_k = 15

    vector_results = await pg_vector_store.vector_search(query, vector_top_k, project_id, db)
    bm25_results = await ts_vector_search.search(query, bm25_top_k, project_id, db)

    if not vector_results and not bm25_results:
        return []

    fused_ids = reciprocal_rank_fusion(vector_results, bm25_results)

    id_to_doc: dict[str, dict] = {}
    for doc in vector_results + bm25_results:
        id_to_doc[doc["chunk_id"]] = doc

    results = [id_to_doc[cid] for cid in fused_ids if cid in id_to_doc]
    results = results[:top_k]

    # Write to cache
    try:
        from app.core.cache import query_cache
        await query_cache.set(query, project_id or "", results)
    except Exception:
        pass

    return results


def format_chunks_with_citations(chunks: list[dict]) -> str:
    formatted = []
    for i, chunk in enumerate(chunks, 1):
        header = f"--- 文献 {i} ---"
        formatted.append(f"{header}\n{chunk['text']}")
    return "\n\n".join(formatted)
