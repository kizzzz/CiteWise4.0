"""Embedding management with LRU cache — ZhipuAI embedding-3."""
import hashlib
import logging
import time
from collections import OrderedDict
from typing import Optional

from openai import OpenAI

from app.config import settings

logger = logging.getLogger(__name__)


class EmbeddingManager:
    """Embedding with LRU cache, backed by ZhipuAI."""

    def __init__(self):
        self.client = OpenAI(
            api_key=settings.llm_api_key,
            base_url=settings.llm_base_url,
        )
        self.model = settings.embedding_model
        self.dimensions = settings.embedding_dim
        self._cache: OrderedDict[str, list[float]] = OrderedDict()
        self._cache_max_size = 1000

    def _content_hash(self, text: str) -> str:
        return hashlib.md5(text.encode("utf-8")).hexdigest()

    def embed(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []

        results: list[Optional[list[float]]] = [None] * len(texts)
        uncached_indices: list[int] = []
        uncached_texts: list[str] = []

        for i, text in enumerate(texts):
            key = self._content_hash(text)
            if key in self._cache:
                results[i] = self._cache[key]
                self._cache.move_to_end(key)
            else:
                uncached_indices.append(i)
                uncached_texts.append(text)

        if uncached_texts:
            api_results = self._call_api(uncached_texts)
            for j, idx in enumerate(uncached_indices):
                if j < len(api_results):
                    results[idx] = api_results[j]
                    key = self._content_hash(uncached_texts[j])
                    self._cache[key] = api_results[j]
                    if len(self._cache) > self._cache_max_size:
                        self._cache.popitem(last=False)

        return [r for r in results if r is not None]

    def _call_api(self, texts: list[str]) -> list[list[float]]:
        for attempt in range(3):
            try:
                resp = self.client.embeddings.create(
                    model=self.model, input=texts, dimensions=self.dimensions
                )
                return [item.embedding for item in resp.data]
            except Exception as e:
                logger.error(f"Embedding failed (attempt {attempt + 1}/3): {e}")
                if attempt < 2:
                    time.sleep(1 * (attempt + 1))
        return []


# Global singleton
embedding_manager = EmbeddingManager()
