"""Redis cache layer — replaces in-memory caches."""

import json
import logging
from typing import Optional

from app.config import settings

logger = logging.getLogger(__name__)

_redis_client = None


def get_redis():
    global _redis_client
    if _redis_client is None:
        try:
            import redis.asyncio as aioredis
            _redis_client = aioredis.from_url(settings.redis_url, decode_responses=True)
            logger.info(f"Redis connected: {settings.redis_url}")
        except Exception as e:
            logger.warning(f"Redis not available, using no-op cache: {e}")
            _redis_client = NoOpCache()
    return _redis_client


class NoOpCache:
    """Fallback when Redis is unavailable."""

    async def get(self, key: str) -> Optional[str]:
        return None

    async def set(self, key: str, value: str, ex: int = None) -> None:
        pass

    async def delete(self, key: str) -> None:
        pass


class QueryCache:
    """Redis-backed query result cache with TTL."""

    def __init__(self, ttl: int = 300, prefix: str = "citewise:query:"):
        self.ttl = ttl
        self.prefix = prefix

    def _key(self, query: str, project_id: str = "") -> str:
        import hashlib
        h = hashlib.md5(f"{query}::{project_id}".encode()).hexdigest()
        return f"{self.prefix}{h}"

    async def get(self, query: str, project_id: str = "") -> Optional[list]:
        redis = get_redis()
        cached = await redis.get(self._key(query, project_id))
        if cached:
            return json.loads(cached)
        return None

    async def set(self, query: str, project_id: str, results: list):
        redis = get_redis()
        await redis.set(
            self._key(query, project_id),
            json.dumps(results, ensure_ascii=False, default=str),
            ex=self.ttl,
        )


class EmbeddingCache:
    """Redis-backed embedding cache — alternative to in-memory LRU."""

    def __init__(self, prefix: str = "citewise:emb:", ttl: int = 86400):
        self.prefix = prefix
        self.ttl = ttl

    async def get(self, text_hash: str) -> Optional[list[float]]:
        redis = get_redis()
        cached = await redis.get(f"{self.prefix}{text_hash}")
        if cached:
            return json.loads(cached)
        return None

    async def set(self, text_hash: str, embedding: list[float]):
        redis = get_redis()
        await redis.set(f"{self.prefix}{text_hash}", json.dumps(embedding), ex=self.ttl)


# Global singletons
query_cache = QueryCache()
embedding_cache = EmbeddingCache()
