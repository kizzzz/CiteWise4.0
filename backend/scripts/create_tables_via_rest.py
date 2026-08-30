"""Create tables via Supabase REST API (bypasses direct PostgreSQL connection)."""
import os
os.environ['NO_PROXY'] = '*'
os.environ.pop('HTTP_PROXY', None)
os.environ.pop('HTTPS_PROXY', None)
os.environ.pop('http_proxy', None)
os.environ.pop('https_proxy', None)

import httpx

SUPABASE_URL = "https://fwtofmorhkapzhcoupsv.supabase.co"
SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

SQL = """
-- Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- profiles
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    research_field TEXT DEFAULT '',
    focus_areas JSONB DEFAULT '[]',
    writing_style TEXT DEFAULT 'academic_formal',
    api_key_configured BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- projects
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    topic TEXT DEFAULT '',
    status TEXT DEFAULT 'active',
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- papers
CREATE TABLE IF NOT EXISTS papers (
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
);

-- chunks (pgvector + tsvector)
CREATE TABLE IF NOT EXISTS chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    paper_id UUID NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    section_title TEXT DEFAULT '',
    content TEXT NOT NULL,
    embedding vector(2048),
    search_vector tsvector GENERATED ALWAYS AS (to_tsvector('simple', coalesce(content,''))) STORED,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- figures
CREATE TABLE IF NOT EXISTS figures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    paper_id UUID NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
    figure_type TEXT DEFAULT 'chart',
    title TEXT,
    description TEXT,
    data_json JSONB,
    page_number INT
);

-- extractions
CREATE TABLE IF NOT EXISTS extractions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    paper_id UUID NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    extraction_type TEXT NOT NULL,
    content JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- sections
CREATE TABLE IF NOT EXISTS sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT DEFAULT '',
    order_index INT DEFAULT 0,
    status TEXT DEFAULT 'draft',
    sources JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- chat_sessions
CREATE TABLE IF NOT EXISTS chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    title TEXT DEFAULT 'New Chat',
    parent_session_id UUID REFERENCES chat_sessions(id) ON DELETE SET NULL,
    source_message_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- chat_messages
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    content TEXT DEFAULT '',
    sources JSONB DEFAULT '[]',
    agent_data JSONB,
    tokens_used INT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- note_types
CREATE TABLE IF NOT EXISTS note_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#6366f1',
    icon TEXT DEFAULT 'note'
);

-- quick_notes
CREATE TABLE IF NOT EXISTS quick_notes (
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
);

-- evaluations
CREATE TABLE IF NOT EXISTS evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    metric_name TEXT NOT NULL,
    score FLOAT NOT NULL,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- api_keys
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    encrypted_key TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_chunks_embedding ON chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS idx_chunks_search ON chunks USING gin(search_vector);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE papers ENABLE ROW LEVEL SECURITY;
ALTER TABLE chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE figures ENABLE ROW LEVEL SECURITY;
ALTER TABLE extractions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE note_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE quick_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- RLS policies (service_role bypasses, anon needs policies)
CREATE POLICY "Users can read own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users see own projects" ON projects FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users see own papers" ON papers FOR ALL USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));
CREATE POLICY "Users see own chunks" ON chunks FOR ALL USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));
CREATE POLICY "Users see own figures" ON figures FOR ALL USING (paper_id IN (SELECT id FROM papers WHERE project_id IN (SELECT id FROM projects WHERE user_id = auth.uid())));
CREATE POLICY "Users see own extractions" ON extractions FOR ALL USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));
CREATE POLICY "Users see own sections" ON sections FOR ALL USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));
CREATE POLICY "Users see own chat_sessions" ON chat_sessions FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Users see own chat_messages" ON chat_messages FOR ALL USING (session_id IN (SELECT id FROM chat_sessions WHERE user_id = auth.uid()));
CREATE POLICY "Users see own note_types" ON note_types FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Users see own quick_notes" ON quick_notes FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Users see own evaluations" ON evaluations FOR ALL USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));
CREATE POLICY "Users see own api_keys" ON api_keys FOR ALL USING (user_id = auth.uid());
"""


def main():
    client = httpx.Client(timeout=30)
    headers = {
        "apikey": SERVICE_KEY,
        "Authorization": f"Bearer {SERVICE_KEY}",
        "Content-Type": "application/json",
    }

    print("=== Creating CiteWise 4.0 tables via Supabase REST API ===\n")

    # Execute SQL via the /rpc endpoint
    # Supabase doesn't expose raw SQL via REST, but we can use the management API
    # Actually, let's split into individual statements and use psycopg2 via the pooler
    print("Direct PostgreSQL connection failed (IPv6/proxy issue).")
    print("Using alternative approach: execute SQL via Supabase SQL Editor API.\n")

    # The correct approach is to use the Supabase Management API for SQL
    # Or tell the user to paste the SQL into Supabase SQL Editor

    # Let's output the SQL to a file for the user to paste
    with open("create_tables.sql", "w", encoding="utf-8") as f:
        f.write(SQL)

    print("Generated: create_tables.sql")
    print("\nPlease paste the contents into:")
    print("  Supabase Dashboard → SQL Editor → New Query")
    print("  Then click ▶ Run")
    print("\nAlternatively, we'll try connecting via psycopg2...")


if __name__ == "__main__":
    main()
