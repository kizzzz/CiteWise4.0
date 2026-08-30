"""LLM client — ZhipuAI GLM (OpenAI-compatible)."""
import json
import logging
import os
import re
from typing import AsyncGenerator, Optional

from openai import AsyncOpenAI, OpenAI

from app.config import settings

logger = logging.getLogger(__name__)


class LLMError(Exception):
    pass


class LLMClient:
    def __init__(self):
        self.client = OpenAI(api_key=settings.llm_api_key, base_url=settings.llm_base_url)
        self._async_client: Optional[AsyncOpenAI] = None
        self.model = settings.llm_model

    @property
    def async_client(self) -> AsyncOpenAI:
        if self._async_client is None:
            self._async_client = AsyncOpenAI(
                api_key=settings.llm_api_key, base_url=settings.llm_base_url
            )
        return self._async_client

    def chat(self, messages: list[dict], temperature: float = 0.7, max_tokens: int = 4000) -> str:
        try:
            response = self.client.chat.completions.create(
                model=self.model, messages=messages,
                temperature=temperature, max_tokens=max_tokens,
            )
            return response.choices[0].message.content
        except Exception as e:
            logger.error(f"LLM call failed: {e}")
            raise LLMError(str(e)) from e

    def chat_json(self, messages: list[dict], temperature: float = 0.3,
                  max_tokens: int = 4000, max_retries: int = 2) -> dict:
        current_messages = list(messages)
        for attempt in range(max_retries + 1):
            text = self.chat(current_messages, temperature=temperature, max_tokens=max_tokens)
            try:
                return json.loads(self._extract_json(text))
            except (json.JSONDecodeError, ValueError):
                if attempt < max_retries:
                    current_messages = list(messages) + [
                        {"role": "user", "content": "上次输出格式有误，请严格按 JSON 格式输出。只输出 JSON。"}
                    ]
                else:
                    raise LLMError(f"JSON parse failed: {text[:200]}")

    async def achat(self, messages: list[dict], temperature: float = 0.7, max_tokens: int = 4000) -> str:
        try:
            response = await self.async_client.chat.completions.create(
                model=self.model, messages=messages,
                temperature=temperature, max_tokens=max_tokens,
            )
            return response.choices[0].message.content
        except Exception as e:
            raise LLMError(str(e)) from e

    async def achat_stream(self, messages: list[dict], temperature: float = 0.7,
                           max_tokens: int = 4000) -> AsyncGenerator[str, None]:
        try:
            stream = await self.async_client.chat.completions.create(
                model=self.model, messages=messages,
                temperature=temperature, max_tokens=max_tokens, stream=True,
            )
            async for chunk in stream:
                delta = chunk.choices[0].delta if chunk.choices else None
                if delta and delta.content:
                    yield delta.content
        except Exception as e:
            raise LLMError(str(e)) from e

    def _extract_json(self, text: str) -> str:
        match = re.search(r"```(?:json)?\s*\n?([\s\S]*?)\n?```", text, re.DOTALL)
        if match:
            return match.group(1).strip()
        text = text.strip()
        return text if text.startswith("{") or text.startswith("[") else text


llm_client = LLMClient()
