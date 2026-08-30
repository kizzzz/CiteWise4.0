"""initial tables

Revision ID: 001
Revises:
Create Date: 2026-04-24
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '001'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Enable pgvector extension
    op.execute('CREATE EXTENSION IF NOT EXISTS vector')

    # profiles
    op.create_table(
        'profiles',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('username', sa.String(100), unique=True, nullable=False),
        sa.Column('research_field', sa.Text, server_default=''),
        sa.Column('focus_areas', postgresql.JSONB, server_default='[]'),
        sa.Column('writing_style', sa.String(50), server_default='academic_formal'),
        sa.Column('api_key_configured', sa.Boolean, server_default='false'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # projects
    op.create_table(
        'projects',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('profiles.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('topic', sa.Text, server_default=''),
        sa.Column('status', sa.String(20), server_default='active'),
        sa.Column('config', postgresql.JSONB, server_default='{}'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # papers
    op.create_table(
        'papers',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('projects.id', ondelete='CASCADE'), nullable=False),
        sa.Column('title', sa.Text),
        sa.Column('authors', sa.Text),
        sa.Column('year', sa.Integer),
        sa.Column('filename', sa.String(500)),
        sa.Column('chunk_count', sa.Integer, server_default='0'),
        sa.Column('raw_text', sa.Text, server_default=''),
        sa.Column('sections_json', postgresql.JSONB, server_default='[]'),
        sa.Column('metadata', postgresql.JSONB, server_default='{}'),
        sa.Column('indexed_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # chunks (pgvector + tsvector)
    op.create_table(
        'chunks',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('paper_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('papers.id', ondelete='CASCADE'), nullable=False),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('projects.id', ondelete='CASCADE'), nullable=False),
        sa.Column('section_title', sa.String(500), server_default=''),
        sa.Column('content', sa.Text, nullable=False),
        sa.Column('embedding', sa.Text),  # pgvector(2048) — added below
        sa.Column('search_vector', sa.Text),  # tsvector — added below
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    # Add pgvector column
    op.execute('ALTER TABLE chunks ALTER COLUMN embedding TYPE vector(2048) USING embedding::vector(2048)')
    # Add tsvector generated column
    op.execute("""
        ALTER TABLE chunks ADD COLUMN search_vector tsvector
        GENERATED ALWAYS AS (to_tsvector('simple', coalesce(content,''))) STORED
    """)
    # Drop the text placeholder and recreate properly
    op.execute('CREATE INDEX idx_chunks_embedding ON chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)')
    op.execute('CREATE INDEX idx_chunks_search ON chunks USING gin(search_vector)')

    # figures
    op.create_table(
        'figures',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('paper_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('papers.id', ondelete='CASCADE'), nullable=False),
        sa.Column('figure_type', sa.String(50), server_default='chart'),
        sa.Column('title', sa.Text),
        sa.Column('description', sa.Text),
        sa.Column('data_json', postgresql.JSONB),
        sa.Column('page_number', sa.Integer),
    )

    # extractions
    op.create_table(
        'extractions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('paper_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('papers.id', ondelete='CASCADE'), nullable=False),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('projects.id', ondelete='CASCADE'), nullable=False),
        sa.Column('extraction_type', sa.String(50), nullable=False),
        sa.Column('content', postgresql.JSONB, nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # sections
    op.create_table(
        'sections',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('projects.id', ondelete='CASCADE'), nullable=False),
        sa.Column('title', sa.String(500), nullable=False),
        sa.Column('content', sa.Text, server_default=''),
        sa.Column('order_index', sa.Integer, server_default='0'),
        sa.Column('status', sa.String(20), server_default='draft'),
        sa.Column('sources', postgresql.JSONB, server_default='[]'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # chat_sessions
    op.create_table(
        'chat_sessions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('projects.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('profiles.id', ondelete='CASCADE'), nullable=False),
        sa.Column('title', sa.String(500), server_default='New Chat'),
        sa.Column('parent_session_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('chat_sessions.id', ondelete='SET NULL')),
        sa.Column('source_message_id', postgresql.UUID(as_uuid=True)),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # chat_messages
    op.create_table(
        'chat_messages',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('session_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('chat_sessions.id', ondelete='CASCADE'), nullable=False),
        sa.Column('role', sa.String(20), nullable=False),
        sa.Column('content', sa.Text, server_default=''),
        sa.Column('sources', postgresql.JSONB, server_default='[]'),
        sa.Column('agent_data', postgresql.JSONB),
        sa.Column('tokens_used', sa.Integer),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # note_types
    op.create_table(
        'note_types',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('profiles.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('color', sa.String(7), server_default='#6366f1'),
        sa.Column('icon', sa.String(50), server_default='note'),
    )

    # quick_notes
    op.create_table(
        'quick_notes',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('projects.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('profiles.id', ondelete='CASCADE'), nullable=False),
        sa.Column('content', sa.Text, nullable=False),
        sa.Column('note_type_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('note_types.id', ondelete='SET NULL')),
        sa.Column('is_pinned', sa.Boolean, server_default='false'),
        sa.Column('related_paper_id', postgresql.UUID(as_uuid=True)),
        sa.Column('ai_category', sa.String(100)),
        sa.Column('merged_into_id', postgresql.UUID(as_uuid=True)),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # evaluations
    op.create_table(
        'evaluations',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('projects.id', ondelete='CASCADE'), nullable=False),
        sa.Column('metric_name', sa.String(100), nullable=False),
        sa.Column('score', sa.Float, nullable=False),
        sa.Column('details', postgresql.JSONB),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # api_keys
    op.create_table(
        'api_keys',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('profiles.id', ondelete='CASCADE'), nullable=False),
        sa.Column('provider', sa.String(50), nullable=False),
        sa.Column('encrypted_key', sa.Text, nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table('api_keys')
    op.drop_table('evaluations')
    op.drop_table('quick_notes')
    op.drop_table('note_types')
    op.drop_table('chat_messages')
    op.drop_table('chat_sessions')
    op.drop_table('sections')
    op.drop_table('extractions')
    op.drop_table('figures')
    op.drop_table('chunks')
    op.drop_table('papers')
    op.drop_table('projects')
    op.drop_table('profiles')
    op.execute('DROP EXTENSION IF EXISTS vector')
