"""Dependency injection for FastAPI routes."""

import asyncio
import logging
import time
import uuid

import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwk, jwt

from app.config import settings
from app.database import SupabaseDB, get_db

security = HTTPBearer()
logger = logging.getLogger(__name__)

__all__ = ["get_db", "get_current_user", "verify_project_owner"]

# ─── Supabase JWKS (ES256 signature verification) ──────────────────────

_jwks_cache: dict = {"keys": [], "fetched_at": 0.0}
_JWKS_TTL_SECONDS = 3600.0


async def _fetch_jwks() -> list[dict]:
    url = f"{settings.supabase_url}/auth/v1/.well-known/jwks.json"
    last_error: Exception | None = None
    for attempt in range(3):
        try:
            async with httpx.AsyncClient(timeout=10, verify=False) as client:
                resp = await client.get(url)
                resp.raise_for_status()
                return resp.json().get("keys", [])
        except (httpx.HTTPError, ValueError) as exc:
            last_error = exc
            await asyncio.sleep(0.5 * (attempt + 1))
    raise last_error  # type: ignore[misc]


async def _get_signing_key(kid: str) -> dict | None:
    keys = _jwks_cache["keys"]
    match = next((k for k in keys if k.get("kid") == kid), None)
    if match and time.time() - _jwks_cache["fetched_at"] < _JWKS_TTL_SECONDS:
        return match
    _jwks_cache["keys"] = await _fetch_jwks()
    _jwks_cache["fetched_at"] = time.time()
    return next((k for k in _jwks_cache["keys"] if k.get("kid") == kid), None)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: SupabaseDB = Depends(get_db),
) -> uuid.UUID:
    """Verify Supabase JWT (ES256 via JWKS) and return the user ID."""
    token = credentials.credentials
    try:
        header = jwt.get_unverified_header(token)
        kid = header.get("kid")
        if not kid:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token missing key id")

        signing = await _get_signing_key(kid)
        if not signing:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unknown signing key")

        key = jwk.construct(signing, algorithm="ES256")
        payload = jwt.decode(
            token,
            key,
            algorithms=["ES256"],
            audience="authenticated",
            issuer=f"{settings.supabase_url}/auth/v1",
        )
        if payload.get("role") != "authenticated":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid role")

        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing subject")
        return uuid.UUID(user_id)
    except HTTPException:
        raise
    except (KeyError, ValueError, JWTError, httpx.HTTPError) as exc:
        logger.error(f"Auth failed: {type(exc).__name__}: {str(exc)[:200]}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        ) from exc


# ─── Resource ownership ────────────────────────────────────────────────


async def verify_project_owner(
    db: SupabaseDB, project_id: str | uuid.UUID, user_id: uuid.UUID
) -> None:
    """Raise 404 unless the project exists and belongs to the user."""
    from app.models.models import Project

    project = await db.get(Project, str(project_id))
    if not project or str(project.get("user_id")) != str(user_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
