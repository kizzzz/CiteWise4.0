# CiteWise 4.0 — 智能研究助手

AI-powered academic research assistant with multi-agent collaboration.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 (App Router) + Tailwind V4 + Shadcn UI |
| Backend | FastAPI + SQLAlchemy async + LangGraph |
| Database | PostgreSQL (Supabase) + pgvector |
| Auth | Supabase Auth (JWT) |
| LLM | ZhipuAI GLM-4 (OpenAI-compatible) |
| Deploy | Vercel (frontend) + Render (backend) |

## Quick Start

### Frontend
```bash
cd frontend
cp .env.local.example .env.local  # Fill in Supabase credentials
npm install
npm run dev  # http://localhost:3000
```

### Backend
```bash
cd backend
cp .env.example .env  # Fill in credentials
pip install -r requirements.txt
uvicorn app.main:app --port 5329 --reload  # http://localhost:5329
```

### Database
```bash
cd backend
alembic upgrade head  # Run migrations
```

## Project Structure

```
CiteWise4.0/
├── frontend/           # Next.js App Router
│   ├── app/            # Pages (auth, dashboard with 8 views)
│   ├── components/     # UI (Shadcn) + layout + feature components
│   ├── hooks/          # use-auth, use-chat-stream, use-project
│   └── lib/            # supabase, api-client, utils
├── backend/            # FastAPI
│   ├── app/
│   │   ├── routes/     # 8 route modules (42 API endpoints)
│   │   ├── models/     # 13 SQLAlchemy ORM models
│   │   ├── schemas/    # Pydantic request/response
│   │   ├── core/       # LLM, embedding, RAG, retriever
│   │   ├── graph/      # LangGraph multi-agent
│   │   └── agents/     # Router, base agent
│   └── alembic/        # Database migrations
```

## API Endpoints (42 total)

| Module | Endpoints | Description |
|--------|-----------|-------------|
| Auth | 3 | Profile CRUD |
| Projects | 5 | Project CRUD |
| Papers | 6 | Upload, list, detail, delete |
| Chat | 5 | SSE streaming, sessions |
| Sections | 7 | Draft CRUD, AI generate, export |
| Notes | 7 | Quick notes CRUD, types |
| Knowledge | 4 | Map, recommend, submit, format-check |
| Settings | 5 | API keys, eval metrics |

## Architecture

```
User → Next.js → FastAPI → LangGraph Supervisor
                              ├── Router → intent classification
                              ├── Researcher → pgvector + tsvector RAG
                              ├── Responder → LLM answer generation
                              ├── Writer → section generation
                              └── Analyst → data analysis
```

## Database (13 tables)

profiles, projects, papers, chunks (pgvector+tsvector), figures, extractions, sections, chat_sessions, chat_messages, quick_notes, note_types, evaluations, api_keys
