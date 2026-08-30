"""FastAPI application entry point."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup/shutdown lifecycle."""
    yield


app = FastAPI(
    title=settings.app_name,
    version="4.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from app.routes import auth, chat, knowledge, notes, papers, projects, sections, user_settings

app.include_router(auth.router, prefix=settings.api_prefix)
app.include_router(projects.router, prefix=settings.api_prefix)
app.include_router(papers.router, prefix=settings.api_prefix + "/papers")
app.include_router(chat.router, prefix=settings.api_prefix)
app.include_router(sections.router, prefix=settings.api_prefix + "/sections")
app.include_router(notes.router, prefix=settings.api_prefix + "/notes")
app.include_router(knowledge.router, prefix=settings.api_prefix + "/knowledge")
app.include_router(user_settings.router, prefix=settings.api_prefix + "/settings")


@app.get("/health")
async def health_check():
    return {"status": "ok", "version": "4.0.0"}
