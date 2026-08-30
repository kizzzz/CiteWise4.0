"""Router agent — keyword-based intent routing."""
import logging

from app.agents.base import BaseAgent

logger = logging.getLogger(__name__)

INTENT_MAP = {
    "summarize": ["总结", "提取", "梳理", "对比", "字段", "表格", "结构化"],
    "generate": ["写", "生成", "撰写", "帮我写", "章节"],
    "framework": ["框架", "思路", "大纲", "怎么写", "结构"],
    "modify": ["修改", "调整", "改写", "重写", "换", "拆分", "合并"],
    "export": ["导出", "下载", "保存", "输出"],
    "chart": ["图表", "柱状图", "饼图", "可视化", "绘图"],
    "websearch": ["最新", "新闻", "最近", "当前", "联网", "搜索"],
    "analyze": ["分析", "洞察", "建议", "推荐", "模式"],
}

ALL_INTENTS = list(INTENT_MAP.keys()) + ["explore"]


class RouterAgent(BaseAgent):
    def __init__(self):
        super().__init__("Router")

    def route(self, user_input: str) -> str:
        intent_scores: dict[str, int] = {}
        for intent, keywords in INTENT_MAP.items():
            score = sum(1 for kw in keywords if kw in user_input)
            if score > 0:
                intent_scores[intent] = score

        if not intent_scores:
            return "explore"

        return max(intent_scores, key=intent_scores.get)

    def process(self, user_input: str, project_id: str = None, **kwargs) -> dict:
        self.reset()
        intent = self.route(user_input)

        agent_map = {
            "explore": "researcher", "summarize": "researcher", "websearch": "researcher",
            "generate": "writer", "modify": "writer", "framework": "writer", "export": "writer",
            "chart": "analyst", "analyze": "analyst",
        }

        target_agent = agent_map.get(intent, "researcher")
        self.think(f"路由 → {intent} → {target_agent}")

        return {
            "intent": intent,
            "target_agent": target_agent,
            "thinking_steps": self.thinking_steps,
        }
