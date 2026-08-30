"""LangGraph multi-agent graph — Supervisor mode."""
import logging
import time

from langgraph.graph import END, START, StateGraph
from langgraph.checkpoint.memory import MemorySaver

from app.graph.state import AgentState
from app.agents.router import RouterAgent

logger = logging.getLogger(__name__)

_router = RouterAgent()


def _ts() -> float:
    return time.time()


async def supervisor_node(state: AgentState) -> dict:
    start = _ts()
    user_input = state.get("user_input", "")
    project_id = state.get("project_id")

    route_result = _router.process(user_input, project_id)
    intent = route_result["intent"]
    target_agent = route_result["target_agent"]

    events = list(state.get("agent_events", [])) + [
        {"agent": "Supervisor", "event": "start", "detail": "分析意图...", "timestamp": start},
        {"agent": "Supervisor", "event": "end", "detail": f"意图={intent} → {target_agent}",
         "timestamp": _ts(), "duration_ms": int((_ts() - start) * 1000)},
    ]

    return {
        "intent": intent, "next_agent": target_agent,
        "thinking_steps": list(state.get("thinking_steps", [])) + route_result.get("thinking_steps", []),
        "agent_events": events,
    }


async def researcher_node(state: AgentState) -> dict:
    start = _ts()
    user_input = state.get("user_input", "")
    project_id = state.get("project_id")
    intent = state.get("intent", "explore")

    from app.core.retriever import hybrid_search, format_chunks_with_citations
    from app.database import SupabaseDB

    events = list(state.get("agent_events", [])) + [
        {"agent": "Researcher", "event": "start", "detail": "检索知识库...", "timestamp": start},
    ]

    top_k = 8 if intent in ("generate", "modify") else 5
    chunks = []
    db = SupabaseDB()
    chunks = await hybrid_search(user_input, top_k=top_k, project_id=project_id, intent=intent, db=db)

    rag_content = format_chunks_with_citations(chunks) if chunks else ""
    sources = [{"title": c.get("paper_title", ""), "citation": c.get("citation", "")} for c in chunks]

    events.append({
        "agent": "Researcher", "event": "end", "detail": f"RAG {len(chunks)} 片段",
        "timestamp": _ts(), "duration_ms": int((_ts() - start) * 1000),
    })

    return {
        "chunks": chunks, "rag_content": rag_content,
        "web_results": [], "sources": sources,
        "thinking_steps": list(state.get("thinking_steps", [])) + [f"RAG 检索到 {len(chunks)} 个片段"],
        "agent_events": events,
    }


async def responder_node(state: AgentState) -> dict:
    start = _ts()
    from app.core.llm import llm_client
    from app.core.prompt import SYSTEM_PROMPT_BASE, prompt_engine

    events = list(state.get("agent_events", [])) + [
        {"agent": "Responder", "event": "start", "detail": "生成回答...", "timestamp": start},
    ]

    user_input = state.get("user_input", "")
    intent = state.get("intent", "explore")
    rag_content = state.get("rag_content", "")
    web_results = state.get("web_results", [])

    prompt = prompt_engine.build_response_prompt(user_input, rag_content, web_results, intent)
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT_BASE},
        {"role": "user", "content": prompt},
    ]

    response = await llm_client.achat(messages, temperature=0.7)

    events.append({
        "agent": "Responder", "event": "end", "detail": f"生成 {len(response)} 字",
        "timestamp": _ts(), "duration_ms": int((_ts() - start) * 1000),
    })

    return {
        "content": response, "response_type": "text",
        "sources": state.get("sources", []),
        "content_sources": {"rag": bool(state.get("chunks")), "llm": True, "web": bool(web_results)},
        "thinking_steps": list(state.get("thinking_steps", [])) + ["回答生成完成"],
        "agent_events": events,
    }


async def writer_node(state: AgentState) -> dict:
    start = _ts()
    from app.core.llm import llm_client
    from app.core.prompt import SYSTEM_PROMPT_BASE, prompt_engine

    events = list(state.get("agent_events", [])) + [
        {"agent": "Writer", "event": "start", "detail": "生成章节...", "timestamp": start},
    ]

    user_input = state.get("user_input", "")
    rag_content = state.get("rag_content", "")
    section_name = _parse_section_name(user_input)

    task_prompt = prompt_engine.build_section_prompt(
        section_name=section_name, section_topic=user_input,
        reference_material=rag_content,
    )
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT_BASE},
        {"role": "user", "content": task_prompt},
    ]
    content = await llm_client.achat(messages, temperature=0.7, max_tokens=4000)

    events.append({
        "agent": "Writer", "event": "end", "detail": f"生成 {len(content)} 字",
        "timestamp": _ts(), "duration_ms": int((_ts() - start) * 1000),
    })

    return {
        "content": content, "response_type": "section", "section_name": section_name,
        "sources": state.get("sources", []),
        "thinking_steps": list(state.get("thinking_steps", [])) + [f"章节 {section_name} 生成完成"],
        "agent_events": events,
    }


async def analyst_node(state: AgentState) -> dict:
    start = _ts()
    from app.core.llm import llm_client
    from app.core.prompt import SYSTEM_PROMPT_BASE

    events = list(state.get("agent_events", [])) + [
        {"agent": "Analyst", "event": "start", "detail": "分析...", "timestamp": start},
    ]

    user_input = state.get("user_input", "")
    rag_content = state.get("rag_content", "")
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT_BASE},
        {"role": "user", "content": f"基于以下材料分析：\n{rag_content}\n\n用户问题：{user_input}"},
    ]
    content = await llm_client.achat(messages, temperature=0.5)

    events.append({
        "agent": "Analyst", "event": "end", "detail": "分析完成",
        "timestamp": _ts(), "duration_ms": int((_ts() - start) * 1000),
    })

    return {
        "content": content, "response_type": "analysis",
        "thinking_steps": list(state.get("thinking_steps", [])) + ["分析完成"],
        "agent_events": events,
    }


# ─── Routing ───

def route_from_supervisor(state: AgentState) -> str:
    intent = state.get("intent", "explore")
    if intent == "export":
        return "writer"
    return "researcher"


def route_after_research(state: AgentState) -> str:
    next_agent = state.get("next_agent", "researcher")
    if next_agent == "writer":
        return "writer"
    if next_agent == "analyst":
        return "analyst"
    return "responder"


def _parse_section_name(user_input: str) -> str:
    section_keywords = {
        "引言": "引言", "背景": "研究背景", "综述": "文献综述",
        "文献": "文献综述", "方法": "方法论", "结果": "研究结果",
        "讨论": "讨论", "结论": "结论",
    }
    for kw, name in section_keywords.items():
        if kw in user_input:
            return name
    return "文献综述"


# ─── Build ───

def build_graph():
    workflow = StateGraph(AgentState)

    workflow.add_node("supervisor", supervisor_node)
    workflow.add_node("researcher", researcher_node)
    workflow.add_node("responder", responder_node)
    workflow.add_node("writer", writer_node)
    workflow.add_node("analyst", analyst_node)

    workflow.add_edge(START, "supervisor")
    workflow.add_conditional_edges("supervisor", route_from_supervisor,
                                   {"researcher": "researcher", "writer": "writer"})
    workflow.add_conditional_edges("researcher", route_after_research,
                                   {"writer": "writer", "analyst": "analyst", "responder": "responder"})
    for node in ("responder", "writer", "analyst"):
        workflow.add_edge(node, END)

    return workflow.compile(checkpointer=MemorySaver())


_graph = None


def get_graph():
    global _graph
    if _graph is None:
        _graph = build_graph()
    return _graph
