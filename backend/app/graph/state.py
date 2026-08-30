"""LangGraph multi-agent state definition."""
from typing import TypedDict


class AgentState(TypedDict, total=False):
    user_input: str
    project_id: str
    session_id: str
    messages: list

    # Routing
    intent: str
    next_agent: str

    # Research
    chunks: list
    rag_content: str
    web_results: list
    sources: list

    # Output
    content: str
    response_type: str
    section_name: str
    citations: dict
    content_sources: dict
    word_count: int

    # Tracking
    thinking_steps: list
    agent_events: list

    # Extra params
    target_content: str
    framework: list
    gen_params: dict
