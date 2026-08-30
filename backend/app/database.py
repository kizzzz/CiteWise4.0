"""Supabase REST API database adapter (replaces direct asyncpg connection)."""

import json
import logging
import uuid
from typing import Any, Optional

import httpx
from sqlalchemy.orm import DeclarativeBase

from app.config import settings

logger = logging.getLogger(__name__)


class Base(DeclarativeBase):
    """Base class for ORM models (used only for type hints, not for queries)."""
    pass


class SupabaseDB:
    """Database adapter using Supabase REST API (PostgREST).

    Provides an interface similar to SQLAlchemy AsyncSession so route
    code requires minimal changes. All operations go through the REST
    API with the service_role key.
    """

    def __init__(self):
        self._base_url = f"{settings.supabase_url}/rest/v1"
        self._headers = {
            "apikey": settings.supabase_service_role_key,
            "Authorization": f"Bearer {settings.supabase_service_role_key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        }
        self._client = httpx.AsyncClient(timeout=30, verify=False)
        # Track pending inserts/updates to flush later
        self._pending_inserts: list[tuple[str, dict]] = []
        self._pending_updates: list[tuple[str, str, dict]] = []  # (table, id, data)
        self._pending_deletes: list[tuple[str, str]] = []  # (table, id)

    def _table_name(self, model_class: type) -> str:
        """Get the table name from a model class."""
        return getattr(model_class, "__tablename__", model_class.__name__.lower())

    # ─── Read operations ──────────────────────────────────────────────

    async def get(self, model_class: type, pk: uuid.UUID | str) -> Optional[dict]:
        """Get a single record by primary key. Returns dict or None."""
        table = self._table_name(model_class)
        resp = await self._client.get(
            f"{self._base_url}/{table}",
            headers=self._headers,
            params={"id": f"eq.{str(pk)}", "limit": "1"},
        )
        if resp.status_code == 200:
            rows = resp.json()
            return rows[0] if rows else None
        logger.warning(f"GET {table}/{pk}: {resp.status_code} {resp.text[:100]}")
        return None

    async def get_by(self, model_class: type, **filters) -> Optional[dict]:
        """Get a single record by filters."""
        rows = await self.select(model_class, **filters, limit=1)
        return rows[0] if rows else None

    async def select(
        self,
        model_class: type,
        *,
        order: str = "",
        limit: int = 0,
        offset: int = 0,
        **filters,
    ) -> list[dict]:
        """Select records with filters. Supports eq, neq, lt, gt, etc."""
        table = self._table_name(model_class)
        params: dict[str, str] = {}
        for key, val in filters.items():
            if val is None:
                continue
            params[key] = f"eq.{val}"

        if order:
            params["order"] = order
        if limit:
            params["limit"] = str(limit)
        if offset:
            params["offset"] = str(offset)

        resp = await self._client.get(
            f"{self._base_url}/{table}",
            headers=self._headers,
            params=params,
        )
        if resp.status_code == 200:
            return resp.json()
        logger.warning(f"SELECT {table}: {resp.status_code} {resp.text[:100]}")
        return []

    async def select_raw(self, table: str, params: dict) -> list[dict]:
        """Raw select with custom PostgREST query params."""
        resp = await self._client.get(
            f"{self._base_url}/{table}",
            headers=self._headers,
            params=params,
        )
        if resp.status_code == 200:
            return resp.json()
        logger.warning(f"SELECT_RAW {table}: {resp.status_code} {resp.text[:100]}")
        return []

    # ─── Write operations (immediate via REST API) ────────────────────

    async def insert(self, model_class_or_table: type | str, data: dict) -> dict:
        """Insert a record. Returns the created record."""
        table = self._table_name(model_class_or_table) if isinstance(model_class_or_table, type) else model_class_or_table
        resp = await self._client.post(
            f"{self._base_url}/{table}",
            headers=self._headers,
            content=json.dumps(data, ensure_ascii=True),
        )
        if resp.status_code in (200, 201):
            rows = resp.json()
            return rows[0] if isinstance(rows, list) and rows else data
        logger.error(f"INSERT {table}: {resp.status_code} {resp.text[:200]}")
        raise Exception(f"Insert failed: {resp.text[:200]}")

    async def update(self, model_class_or_table: type | str, pk: uuid.UUID | str, data: dict) -> dict:
        """Update a record by primary key. Returns updated record."""
        table = self._table_name(model_class_or_table) if isinstance(model_class_or_table, type) else model_class_or_table
        resp = await self._client.patch(
            f"{self._base_url}/{table}",
            headers=self._headers,
            params={"id": f"eq.{str(pk)}"},
            content=json.dumps(data, ensure_ascii=True),
        )
        if resp.status_code in (200, 204):
            if resp.text:
                rows = resp.json()
                return rows[0] if isinstance(rows, list) and rows else data
            return data
        logger.error(f"UPDATE {table}/{pk}: {resp.status_code} {resp.text[:200]}")
        raise Exception(f"Update failed: {resp.text[:200]}")

    async def delete(self, model_class_or_table: type | str, pk: uuid.UUID | str) -> bool:
        """Delete a record by primary key."""
        table = self._table_name(model_class_or_table) if isinstance(model_class_or_table, type) else model_class_or_table
        resp = await self._client.delete(
            f"{self._base_url}/{table}",
            headers={**self._headers, "Prefer": "return=minimal"},
            params={"id": f"eq.{str(pk)}"},
        )
        return resp.status_code in (200, 204)

    async def delete_by(self, model_class_or_table: type | str, **filters) -> bool:
        """Delete records matching filters."""
        table = self._table_name(model_class_or_table) if isinstance(model_class_or_table, type) else model_class_or_table
        params = {k: f"eq.{v}" for k, v in filters.items() if v is not None}
        resp = await self._client.delete(
            f"{self._base_url}/{table}",
            headers={**self._headers, "Prefer": "return=minimal"},
            params=params,
        )
        return resp.status_code in (200, 204)

    # ─── Compatibility methods (match SQLAlchemy session interface) ────

    def add(self, obj: Any) -> None:
        """Queue an insert. Actually executed on flush()."""
        table = self._table_name(type(obj))
        data = self._model_to_dict(obj)
        self._pending_inserts.append((table, data))

    async def flush(self) -> None:
        """Execute all pending operations."""
        # Execute inserts
        for table, data in self._pending_inserts:
            await self.insert(table, data)
        self._pending_inserts.clear()

        # Execute updates
        for table, pk, data in self._pending_updates:
            await self.update(table, pk, data)
        self._pending_updates.clear()

        # Execute deletes
        for table, pk in self._pending_deletes:
            await self.delete(table, pk)
        self._pending_deletes.clear()

    async def refresh(self, obj: Any) -> None:
        """Refresh object data from DB (no-op for REST — data is already current)."""
        pass

    async def commit(self) -> None:
        """Commit = flush all pending operations."""
        await self.flush()

    async def rollback(self) -> None:
        """Rollback = discard pending operations."""
        self._pending_inserts.clear()
        self._pending_updates.clear()
        self._pending_deletes.clear()

    def _model_to_dict(self, obj: Any) -> dict:
        """Convert an ORM model instance to a dict for REST API."""
        data = {}
        for col in obj.__table__.columns:
            val = getattr(obj, col.key, None)
            if val is not None:
                if isinstance(val, uuid.UUID):
                    val = str(val)
                data[col.key] = val
        return data

    # ─── SQL execution via Management API ─────────────────────────────

    async def execute_sql(self, query: str) -> list[dict]:
        """Execute raw SQL via Supabase Management API."""
        access_token = os.environ.get("SUPABASE_ACCESS_TOKEN", "")
        if not access_token:
            return []
        resp = await self._client.post(
            f"https://api.supabase.com/v1/projects/"
            f"{settings.supabase_url.split('//')[1].split('.')[0]}/database/query",
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json",
            },
            json={"query": query},
            proxy="http://127.0.0.1:10808",
        )
        if resp.status_code in (200, 201):
            return resp.json()
        return []


import os

# No longer create async engine — use REST API instead
# (kept for backward compat if anyone imports these)
engine = None
async_session_factory = None


async def get_db():
    """FastAPI dependency that yields a SupabaseDB instance."""
    db = SupabaseDB()
    try:
        yield db
    except Exception:
        await db.rollback()
        raise
