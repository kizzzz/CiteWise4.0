"""PostgreSQL tsvector-based full-text search — replaces pickle BM25."""
import logging
import re

from app.database import SupabaseDB

logger = logging.getLogger(__name__)


class TsVectorSearch:
    """Full-text search using PostgreSQL tsvector.

    Uses execute_sql because PostgREST does not expose ts_rank or @@ operators.
    """

    async def search(
        self,
        query: str,
        top_k: int = 20,
        project_id: str | None = None,
        db: SupabaseDB = None,
    ) -> list[dict]:
        """Full-text search using tsvector ranking."""
        if not db or not query.strip():
            return []

        safe_query = query.replace("'", "''")[:200]

        where_clause = ""
        if project_id:
            where_clause = f"AND project_id = '{project_id}'"

        sql = f"""
            SELECT id, paper_id, content, section_title,
                   ts_rank(search_vector, plainto_tsquery('simple', '{safe_query}')) AS rank
            FROM chunks
            WHERE search_vector @@ plainto_tsquery('simple', '{safe_query}')
            {where_clause}
            ORDER BY rank DESC
            LIMIT {top_k}
        """
        rows = await db.execute_sql(sql)

        return [
            {
                "chunk_id": str(r.get("id", "")),
                "paper_id": str(r.get("paper_id", "")),
                "text": r.get("content", ""),
                "section_title": r.get("section_title", ""),
                "bm25_score": float(r.get("rank", 0)),
                "metadata": {"section_title": r.get("section_title", "")},
            }
            for r in rows
        ]


# Global singleton
ts_vector_search = TsVectorSearch()
