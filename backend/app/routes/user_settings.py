"""Settings, API key management, and eval routes."""

import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.deps import get_current_user, get_db, verify_project_owner
from app.database import SupabaseDB
from app.models.models import ApiKey, Evaluation

router = APIRouter(tags=["settings"])


# ─── API Keys ───

class ApiKeyCreate(BaseModel):
    provider: str  # e.g., "zhipu", "openai"
    key: str


@router.get("/api-keys")
async def list_api_keys(
    user_id: uuid.UUID = Depends(get_current_user),
    db: SupabaseDB = Depends(get_db),
):
    keys = await db.select(ApiKey, user_id=str(user_id))
    return [
        {
            "id": str(k["id"]),
            "provider": k["provider"],
            "created_at": k["created_at"] if isinstance(k["created_at"], str) else k["created_at"].isoformat(),
        }
        for k in keys
    ]


@router.post("/api-keys")
async def create_api_key(
    data: ApiKeyCreate,
    user_id: uuid.UUID = Depends(get_current_user),
    db: SupabaseDB = Depends(get_db),
):
    """Store encrypted API key (simplified -- in production use proper encryption)."""
    # TODO: Use Fernet encryption in production
    import hashlib
    encrypted = hashlib.sha256(data.key.encode()).hexdigest()  # Placeholder
    row = await db.insert(ApiKey, {
        "user_id": str(user_id),
        "provider": data.provider,
        "encrypted_key": encrypted,
    })
    return {"id": str(row["id"]), "provider": data.provider}


@router.delete("/api-keys/{key_id}", status_code=204)
async def delete_api_key(
    key_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user),
    db: SupabaseDB = Depends(get_db),
):
    key = await db.get(ApiKey, str(key_id))
    if key and key.get("user_id") == str(user_id):
        await db.delete(ApiKey, str(key_id))


# ─── Eval ───

@router.get("/eval/summary")
async def eval_summary(
    project_id: str,
    user_id: uuid.UUID = Depends(get_current_user),
    db: SupabaseDB = Depends(get_db),
):
    """Get evaluation summary for a project."""
    await verify_project_owner(db, project_id, user_id)
    evals = await db.select(
        Evaluation,
        project_id=str(project_id),
        order="created_at.desc",
        limit=100,
    )

    if not evals:
        return {"total": 0, "metrics": {}, "trend": []}

    # Group by metric
    metrics: dict[str, list[float]] = {}
    for e in evals:
        metrics.setdefault(e["metric_name"], []).append(e["score"])

    summary = {
        "total": len(evals),
        "metrics": {
            name: {"avg": sum(scores) / len(scores), "count": len(scores), "latest": scores[0]}
            for name, scores in metrics.items()
        },
        "trend": [
            {
                "metric": e["metric_name"],
                "score": e["score"],
                "created_at": e["created_at"] if isinstance(e["created_at"], str) else e["created_at"].isoformat(),
            }
            for e in evals[:20]
        ],
    }
    return summary


@router.post("/eval/record")
async def record_eval(
    project_id: str,
    metric_name: str,
    score: float,
    details: dict = None,
    user_id: uuid.UUID = Depends(get_current_user),
    db: SupabaseDB = Depends(get_db),
):
    """Record an evaluation metric."""
    await verify_project_owner(db, project_id, user_id)
    if not 0 <= score <= 1e9:
        raise HTTPException(status_code=422, detail="Invalid score")
    row = await db.insert(Evaluation, {
        "project_id": str(project_id),
        "metric_name": metric_name,
        "score": score,
        "details": details,
    })
    return {"status": "ok", "id": str(row["id"])}
