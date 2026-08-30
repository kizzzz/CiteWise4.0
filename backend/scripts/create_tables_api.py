"""Create all CiteWise 4.0 tables via Supabase Management API."""
import os
os.environ['NO_PROXY'] = '*'
os.environ.pop('HTTP_PROXY', None)
os.environ.pop('HTTPS_PROXY', None)

import httpx
import json

PROJECT_REF = "fwtofmorhkapzhcoupsv"
ACCESS_TOKEN = os.environ.get("SUPABASE_ACCESS_TOKEN", "")

headers = {
    "Authorization": f"Bearer {ACCESS_TOKEN}",
    "Content-Type": "application/json",
}

SQL_URL = f"https://api.supabase.com/v1/projects/{PROJECT_REF}/database/query"

client = httpx.Client(timeout=30, verify=False, proxy="http://127.0.0.1:10808")


def exec_sql(label: str, sql: str) -> bool:
    resp = client.post(SQL_URL, headers=headers, json={"query": sql})
    ok = resp.status_code in (200, 201)
    detail = "" if ok else resp.text[:120]
    print(f"  {label:45s} {'OK' if ok else 'FAIL'} {detail}")
    return ok


def main():
    print("=== CiteWise 4.0 — Database Setup via Management API ===\n")

    # 1. Enable pgvector
    print("Step 1: Enable pgvector")
    exec_sql("vector extension", "CREATE EXTENSION IF NOT EXISTS vector;")

    # 2. Create tables (dependency order)
    print("\nStep 2: Create 13 tables")
    tables = [
        ("profiles", """CREATE TABLE IF NOT EXISTS profiles (
            id UUID PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            research_field TEXT DEFAULT '',
            focus_areas JSONB DEFAULT '[]',
            writing_style TEXT DEFAULT 'academic_formal',
            api_key_configured BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );"""),
        ("projects", """CREATE TABLE IF NOT EXISTS projects (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            topic TEXT DEFAULT '',
            status TEXT DEFAULT 'active',
            config JSONB DEFAULT '{}',
            created_at TIMESTAMPTZ DEFAULT NOW()
        );"""),
        ("papers", """CREATE TABLE IF NOT EXISTS papers (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            title TEXT,
            authors TEXT,
            year INT,
            filename TEXT,
            chunk_count INT DEFAULT 0,
            raw_text TEXT DEFAULT '',
            sections_json JSONB DEFAULT '[]',
            metadata JSONB DEFAULT '{}',
            indexed_at TIMESTAMPTZ DEFAULT NOW()
        );"""),
        ("chunks", """CREATE TABLE IF NOT EXISTS chunks (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            paper_id UUID NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
            project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            section_title TEXT DEFAULT '',
            content TEXT NOT NULL,
            embedding vector(2048),
            search_vector tsvector GENERATED ALWAYS AS (to_tsvector('simple', coalesce(content,''))) STORED,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );"""),
        ("figures", """CREATE TABLE IF NOT EXISTS figures (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            paper_id UUID NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
            figure_type TEXT DEFAULT 'chart',
            title TEXT,
            description TEXT,
            data_json JSONB,
            page_number INT
        );"""),
        ("extractions", """CREATE TABLE IF NOT EXISTS extractions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            paper_id UUID NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
            project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            extraction_type TEXT NOT NULL,
            content JSONB NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );"""),
        ("sections", """CREATE TABLE IF NOT EXISTS sections (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            title TEXT NOT NULL,
            content TEXT DEFAULT '',
            order_index INT DEFAULT 0,
            status TEXT DEFAULT 'draft',
            sources JSONB DEFAULT '[]',
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );"""),
        ("chat_sessions", """CREATE TABLE IF NOT EXISTS chat_sessions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
            title TEXT DEFAULT 'New Chat',
            parent_session_id UUID REFERENCES chat_sessions(id) ON DELETE SET NULL,
            source_message_id UUID,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );"""),
        ("chat_messages", """CREATE TABLE IF NOT EXISTS chat_messages (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
            role TEXT NOT NULL,
            content TEXT DEFAULT '',
            sources JSONB DEFAULT '[]',
            agent_data JSONB,
            tokens_used INT,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );"""),
        ("note_types", """CREATE TABLE IF NOT EXISTS note_types (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            color TEXT DEFAULT '#6366f1',
            icon TEXT DEFAULT 'note'
        );"""),
        ("quick_notes", """CREATE TABLE IF NOT EXISTS quick_notes (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
            content TEXT NOT NULL,
            note_type_id UUID REFERENCES note_types(id) ON DELETE SET NULL,
            is_pinned BOOLEAN DEFAULT FALSE,
            related_paper_id UUID,
            ai_category TEXT,
            merged_into_id UUID,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );"""),
        ("evaluations", """CREATE TABLE IF NOT EXISTS evaluations (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            metric_name TEXT NOT NULL,
            score FLOAT NOT NULL,
            details JSONB,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );"""),
        ("api_keys", """CREATE TABLE IF NOT EXISTS api_keys (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
            provider TEXT NOT NULL,
            encrypted_key TEXT NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );"""),
    ]
    for name, sql in tables:
        exec_sql(name, sql)

    # 3. Indexes
    print("\nStep 3: Create indexes")
    exec_sql(
        "idx_chunks_embedding (ivfflat)",
        "CREATE INDEX IF NOT EXISTS idx_chunks_embedding ON chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);"
    )
    exec_sql(
        "idx_chunks_search (gin)",
        "CREATE INDEX IF NOT EXISTS idx_chunks_search ON chunks USING gin(search_vector);"
    )

    # 4. Enable RLS
    print("\nStep 4: Enable RLS on all tables")
    for t in ['profiles', 'projects', 'papers', 'chunks', 'figures', 'extractions',
              'sections', 'chat_sessions', 'chat_messages', 'note_types', 'quick_notes',
              'evaluations', 'api_keys']:
        exec_sql(f"RLS {t}", f"ALTER TABLE {t} ENABLE ROW LEVEL SECURITY;")

    # 5. RLS policies
    print("\nStep 5: Create RLS policies")
    policies = [
        ('profiles SELECT', 'CREATE POLICY "Users can read own profile" ON profiles FOR SELECT USING (auth.uid() = id);'),
        ('profiles UPDATE', 'CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);'),
        ('projects ALL', 'CREATE POLICY "Users see own projects" ON projects FOR ALL USING (auth.uid() = user_id);'),
        ('papers ALL', 'CREATE POLICY "Users see own papers" ON papers FOR ALL USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));'),
        ('chunks ALL', 'CREATE POLICY "Users see own chunks" ON chunks FOR ALL USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));'),
        ('figures ALL', 'CREATE POLICY "Users see own figures" ON figures FOR ALL USING (paper_id IN (SELECT id FROM papers WHERE project_id IN (SELECT id FROM projects WHERE user_id = auth.uid())));'),
        ('extractions ALL', 'CREATE POLICY "Users see own extractions" ON extractions FOR ALL USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));'),
        ('sections ALL', 'CREATE POLICY "Users see own sections" ON sections FOR ALL USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));'),
        ('chat_sessions ALL', 'CREATE POLICY "Users see own chat_sessions" ON chat_sessions FOR ALL USING (user_id = auth.uid());'),
        ('chat_messages ALL', 'CREATE POLICY "Users see own chat_messages" ON chat_messages FOR ALL USING (session_id IN (SELECT id FROM chat_sessions WHERE user_id = auth.uid()));'),
        ('note_types ALL', 'CREATE POLICY "Users see own note_types" ON note_types FOR ALL USING (user_id = auth.uid());'),
        ('quick_notes ALL', 'CREATE POLICY "Users see own quick_notes" ON quick_notes FOR ALL USING (user_id = auth.uid());'),
        ('evaluations ALL', 'CREATE POLICY "Users see own evaluations" ON evaluations FOR ALL USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));'),
        ('api_keys ALL', 'CREATE POLICY "Users see own api_keys" ON api_keys FOR ALL USING (user_id = auth.uid());'),
    ]
    for name, sql in policies:
        exec_sql(name, sql)

    # 6. Verify
    print("\n=== Verification ===")
    resp = client.post(SQL_URL, headers=headers, json={
        "query": "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename;"
    })
    if resp.status_code == 200:
        rows = resp.json()
        print(f"  Total tables: {len(rows)}")
        for r in rows:
            print(f"    - {r['tablename']}")
    else:
        print(f"  Verify failed: {resp.status_code} {resp.text[:200]}")

    print("\n=== Database setup complete! ===")


if __name__ == "__main__":
    main()
