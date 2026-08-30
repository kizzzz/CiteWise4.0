"""Prompt templates and engine for CiteWise."""

SYSTEM_PROMPT_BASE = """你是 CiteWise，一个专业的学术研究助手。你的任务是基于用户上传的文献库，辅助完成文献梳理、思路构建和论文写作。

## 核心约束（必须严格遵守）
1. 【强制溯源】所有观点、数据、结论必须引用知识库中的文献，格式：[作者, 年份]。无法引用时明确告知"该内容超出知识库范围"。
2. 【禁止幻觉】不得编造论文、数据、方法或结论。不确定时回答"我需要更多信息"。
3. 【结构化输出】严格按照要求的格式输出（Markdown表格/JSON/指定章节格式）。
4. 【忠实原文】提取信息时忠于原文表述，不得过度解读或推断。"""


class PromptEngine:
    def build_system_prompt(self, user_profile: dict = None, project_state: dict = None) -> str:
        prompt = SYSTEM_PROMPT_BASE
        if user_profile:
            prompt += f"\n## 用户画像\n- 研究领域：{user_profile.get('research_field', '未设定')}\n"
            prompt += f"- 关注方向：{', '.join(user_profile.get('focus_areas', []))}\n"
        return prompt

    def build_response_prompt(self, user_input: str, rag_content: str = "",
                              web_results: list = None, intent: str = "explore") -> str:
        safe_input = user_input.replace("```", " ").strip()
        if intent == "websearch" and web_results:
            web_snippets = "\n".join(
                f"- [{r.get('title', '')}]({r.get('url', '')}): {r.get('snippet', '')}"
                for r in web_results
            )
            return (
                f"## 用户问题\n{safe_input}\n\n"
                f"## 网络搜索结果\n{web_snippets}\n\n"
                f"## 知识库文献\n{rag_content or '（无）'}\n\n"
                "请整合以上来源回答用户问题，使用 [作者, 年份] 标注引用。"
            )
        return (
            f"## 用户问题\n{safe_input}\n\n"
            f"## 参考材料（知识库检索）\n{rag_content or '（无相关内容）'}\n\n"
            "请基于参考材料和自身知识回答，使用 [作者, 年份] 标注引用。"
        )

    def build_section_prompt(self, section_name: str, section_topic: str,
                             reference_material: str, framework: str = "",
                             previous_summary: str = "（这是第一章，无前文）",
                             target_words: int = 1000, writing_style: str = "学术正式") -> str:
        return f"""## 任务：生成论文章节

你正在为一篇学术论文生成「{section_name}」章节。

### 论文整体框架
{framework or '（框架未设定）'}

### 当前章节要求
- 主题：{section_topic}
- 目标字数：{target_words} 字
- 写作风格：{writing_style}

### 参考材料（来自知识库检索）
{reference_material}

### 输出要求
1. 学术写作风格，逻辑清晰
2. 每个观点/数据必须附带引用：[作者, 年份]
3. 如果该内容超出知识库范围，明确标注"""


prompt_engine = PromptEngine()
