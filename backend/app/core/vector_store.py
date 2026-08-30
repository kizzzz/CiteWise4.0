"""pgvector-based vector store — replaces ChromaDB."""
import uuid
import logging
from typing import Optional

import numpy as np

from app.core.embedding import embedding_manager
from app.database import SupabaseDB

logger = logging.getLogger(__name__)


class PgVectorStore:
    """PostgreSQL + pgvector vector store.

    Note: vector_search still requires execute_sql because cosine distance
    is not exposed via PostgREST.  index_chunks and delete_by_paper use the
    REST API directly.
    """

    async def index_chunks(self, chunks: list[dict], db: SupabaseDB):
        """Index chunks with embeddings via Supabase REST API."""
        if not chunks:
            return

        batch_size = 16
        total_inserted = 0
        for i in range(0, len(chunks), batch_size):
            batch = chunks[i : i + batch_size]
            texts = [c["text"] for c in batch]
            embeddings = embedding_manager.embed(texts)

            for j, chunk_data in enumerate(batch):
                embedding = embeddings[j] if j < len(embeddings) else None
                row = {
                    "id": str(uuid.uuid4()),
                    "paper_id": str(chunk_data["paper_id"]),
                    "project_id": str(chunk_data.get("project_id", "00000000-0000-0000-0000-000000000000")),
                    "section_title": chunk_data.get("section_title", ""),
                    "content": chunk_data["text"],
                }
                # pgvector embedding stored as a string representation of the vector
                if embedding is not None:
                    row["embedding"] = str(embedding.tolist()) if hasattr(embedding, "tolist") else str(embedding)

                await db.insert("chunks", row)
                total_inserted += 1

        logger.info(f"Indexed {total_inserted} chunks via REST API")

    async def vector_search(
        self,
        query: str,
        top_k: int = 20,
        project_id: Optional[str] = None,
        db: SupabaseDB = None,
    ) -> list[dict]:
        """Cosine similarity search.

        Chunks are fetched via PostgREST and ranked in-process — avoids the
        Management API / raw-SQL dependency while staying accurate for
        knowledge bases of this project's scale.
        """
        if not db:
            return []
        query_embedding = embedding_manager.embed([query])
        if not query_embedding or query_embedding[0] is None:
            return []

        qvec = np.asarray(query_embedding[0], dtype=np.float32)
        qnorm = float(np.linalg.norm(qvec))
        if qnorm == 0.0:
            return []

        params: dict = {
            "select": "id,paper_id,section_title,content,embedding,papers(title)",
            "embedding": "not.is.null",
            "limit": "500",
        }
        if project_id:
            params["project_id"] = f"eq.{str(uuid.UUID(str(project_id)))}"

        rows = await db.select_raw("chunks", params)

        scored: list[tuple[float, dict]] = []
        for r in rows:
            raw = r.get("embedding")
            if raw is None:
                continue
            if isinstance(raw, str):
                raw = raw.strip().strip("[]")
                if not raw:
                    continue
                vec = np.array(raw.split(","), dtype=np.float32)
            else:
                vec = np.asarray(raw, dtype=np.float32)
            if vec.size != qvec.size:
                continue
            norm = float(np.linalg.norm(vec))
            if norm == 0.0:
                continue
            score = float(np.dot(vec, qvec) / (norm * qnorm))
            scored.append((score, r))

        scored.sort(key=lambda t: t[0], reverse=True)
        return [
            {
                "chunk_id": str(r.get("id", "")),
                "paper_id": str(r.get("paper_id", "")),
                "paper_title": ((r.get("papers") or {}).get("title")) or "",
                "text": r.get("content", ""),
                "section_title": r.get("section_title", ""),
                "metadata": {"section_title": r.get("section_title", ""), "score": round(s, 4)},
            }
            for s, r in scored[:top_k]
        ]

    async def delete_by_paper(self, paper_id: str, db: SupabaseDB):
        """Delete all chunks for a paper via REST API."""
        await db.delete_by("chunks", paper_id=paper_id)


# Global singleton
pg_vector_store = PgVectorStore()
