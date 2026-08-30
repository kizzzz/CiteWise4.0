"""Migrate data from CiteWise v3 (SQLite + ChromaDB) to v4 (PostgreSQL + pgvector).

Usage:
    cd C:/Users/77230/CiteWise4.0/backend
    python scripts/migrate_v3_to_v4.py

Prerequisites:
    - Set DATABASE_URL in .env pointing to Supabase PostgreSQL
    - Run `alembic upgrade head` first
    - CiteWise v3 at C:/Users/77230/CiteWise/ must exist
"""
import asyncio
import json
import os
import sys
import uuid

# Add v3 project to path
V3_PATH = os.path.expanduser("~/CiteWise")
sys.path.insert(0, V3_PATH)

# Add v4 backend to path
V4_PATH = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, V4_PATH)

os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://postgres:pass@localhost/citewise")


async def migrate():
    print("=== CiteWise v3 → v4 Migration ===\n")

    # --- v3 source ---
    from config.settings import PAPERS_DIR as V3_PAPERS_DIR, DB_PATH as V3_DB_PATH
    import sqlite3

    # --- v4 destination ---
    from app.database import async_session_factory, Base
    from app.models.models import (
        Profile, Project, Paper, Chunk, Section,
        ChatSession, ChatMessage, QuickNote, Evaluation,
    )

    # 1. Connect to v3 SQLite
    print(f"Connecting to v3 database: {V3_DB_PATH}")
    v3_conn = sqlite3.connect(V3_DB_PATH)
    v3_conn.row_factory = sqlite3.Row
    v3_cur = v3_conn.cursor()

    # 2. Check tables exist
    v3_cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
    v3_tables = {r[0] for r in v3_cur.fetchall()}
    print(f"v3 tables found: {v3_tables}\n")

    # 3. Create a default profile for migration
    default_user_id = uuid.UUID("00000000-0000-0000-0000-000000000001")

    async with async_session_factory() as db:
        # Check if profile exists
        from sqlalchemy import select
        existing = await db.get(Profile, default_user_id)
        if not existing:
            profile = Profile(
                id=default_user_id,
                username="migrated_user",
                research_field="",
            )
            db.add(profile)
            await db.flush()
            print("Created default migration profile\n")

        # 4. Migrate projects
        if "projects" in v3_tables:
            v3_cur.execute("SELECT * FROM projects")
            v3_projects = v3_cur.fetchall()
            print(f"Migrating {len(v3_projects)} projects...")
            for p in v3_projects:
                project_id = uuid.UUID(p["id"]) if _is_valid_uuid(p["id"]) else uuid.uuid4()
                existing = await db.get(Project, project_id)
                if not existing:
                    project = Project(
                        id=project_id,
                        user_id=default_user_id,
                        name=p.get("name", "Migrated Project"),
                        topic=p.get("topic", ""),
                        status=p.get("status", "active"),
                    )
                    db.add(project)
            await db.flush()
            print(f"  Projects migrated: {len(v3_projects)}")

        # 5. Migrate papers
        if "papers" in v3_tables:
            v3_cur.execute("SELECT * FROM papers")
            v3_papers = v3_cur.fetchall()
            print(f"Migrating {len(v3_papers)} papers...")
            migrated_papers = 0
            for p in v3_papers:
                try:
                    paper_id = uuid.UUID(p["id"]) if _is_valid_uuid(p["id"]) else uuid.uuid4()
                    project_id = uuid.UUID(p["project_id"]) if _is_valid_uuid(p.get("project_id", "")) else None
                    if not project_id:
                        continue

                    existing = await db.get(Paper, paper_id)
                    if existing:
                        continue

                    sections_json = []
                    if p.get("sections_json"):
                        try:
                            sections_json = json.loads(p["sections_json"])
                        except (json.JSONDecodeError, TypeError):
                            sections_json = []

                    paper = Paper(
                        id=paper_id,
                        project_id=project_id,
                        title=p.get("title"),
                        authors=p.get("authors"),
                        year=p.get("year"),
                        filename=p.get("filename"),
                        chunk_count=p.get("chunk_count", 0),
                        raw_text=p.get("raw_text", ""),
                        sections_json=sections_json,
                        metadata_=json.loads(p.get("metadata", "{}")) if p.get("metadata") else {},
                    )
                    db.add(paper)
                    migrated_papers += 1
                except Exception as e:
                    print(f"  Skip paper {p.get('id', '?')}: {e}")
            await db.flush()
            print(f"  Papers migrated: {migrated_papers}")

        # 6. Migrate sections (draft)
        if "sections" in v3_tables:
            v3_cur.execute("SELECT * FROM sections")
            v3_sections = v3_cur.fetchall()
            print(f"Migrating {len(v3_sections)} sections...")
            for s in v3_sections:
                try:
                    section = Section(
                        id=uuid.uuid4(),
                        project_id=uuid.UUID(s["project_id"]),
                        title=s.get("title", ""),
                        content=s.get("content", ""),
                        order_index=s.get("order_index", 0),
                        status=s.get("status", "draft"),
                        sources=json.loads(s.get("sources", "[]")) if s.get("sources") else [],
                    )
                    db.add(section)
                except Exception as e:
                    print(f"  Skip section: {e}")
            await db.flush()

        # 7. Migrate chat sessions + messages
        if "chat_sessions" in v3_tables:
            v3_cur.execute("SELECT * FROM chat_sessions")
            sessions = v3_cur.fetchall()
            print(f"Migrating {len(sessions)} chat sessions...")
            for s in sessions:
                try:
                    session = ChatSession(
                        id=uuid.UUID(s["id"]),
                        project_id=uuid.UUID(s["project_id"]),
                        user_id=default_user_id,
                        title=s.get("title", "Migrated Chat"),
                    )
                    db.add(session)
                except Exception as e:
                    print(f"  Skip session: {e}")
            await db.flush()

        if "chat_messages" in v3_tables:
            v3_cur.execute("SELECT * FROM chat_messages")
            messages = v3_cur.fetchall()
            print(f"Migrating {len(messages)} chat messages...")
            for m in messages:
                try:
                    msg = ChatMessage(
                        id=uuid.UUID(m["id"]),
                        session_id=uuid.UUID(m["session_id"]),
                        role=m["role"],
                        content=m.get("content", ""),
                        sources=json.loads(m.get("sources", "[]")) if m.get("sources") else [],
                    )
                    db.add(msg)
                except Exception as e:
                    print(f"  Skip message: {e}")
            await db.flush()

        # 8. Migrate quick notes
        if "quick_notes" in v3_tables:
            v3_cur.execute("SELECT * FROM quick_notes")
            notes = v3_cur.fetchall()
            print(f"Migrating {len(notes)} quick notes...")
            for n in notes:
                try:
                    note = QuickNote(
                        id=uuid.uuid4(),
                        project_id=uuid.UUID(n["project_id"]),
                        user_id=default_user_id,
                        content=n["content"],
                        is_pinned=bool(n.get("is_pinned", 0)),
                        ai_category=n.get("ai_category"),
                    )
                    db.add(note)
                except Exception as e:
                    print(f"  Skip note: {e}")
            await db.flush()

        await db.commit()
        print("\n=== Migration complete! ===")
        print("Note: Chunks with embeddings need re-indexing via the paper upload flow.")
        print("Run: Upload papers again or use the re-index endpoint.")

    v3_conn.close()


def _is_valid_uuid(val: str) -> bool:
    try:
        uuid.UUID(val)
        return True
    except (ValueError, TypeError, AttributeError):
        return False


if __name__ == "__main__":
    asyncio.run(migrate())
