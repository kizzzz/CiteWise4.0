"use client";

import { useState, useRef, useEffect } from "react";
import { Plus, Table, Zap, History, MessageSquare, Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { useChatStream } from "@/hooks/use-chat-stream";
import { useChatSessions } from "@/hooks/use-chat-sessions";
import { useProject } from "@/hooks/use-project";
import { MessageBubble } from "@/components/chat/message-bubble";
import { AgentTimeline } from "@/components/chat/agent-timeline";
import { ModelSelector } from "@/components/chat/model-selector";

export default function ChatPage() {
  const { activeProject } = useProject();
  const {
    messages,
    agentTimeline,
    isStreaming,
    sessionId,
    loadSession,
    loadMessages,
    sendMessage,
    regenerate,
    stop,
    clear,
  } = useChatStream();
  const { sessions, loading: sessionsLoading, loadSessions, renameSession, deleteSession, fetchHistory } = useChatSessions();
  const [input, setInput] = useState("");
  const [model, setModel] = useState("glm-4-0520");
  const [showSessions, setShowSessions] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (activeProject) loadSessions(activeProject.id);
  }, [activeProject?.id, loadSessions]);

  useEffect(() => {
    if (sessionId && activeProject) loadSessions(activeProject.id);
  }, [sessionId, activeProject, loadSessions]);

  async function handleSend() {
    if (!input.trim() || !activeProject || isStreaming) return;
    const msg = input.trim();
    setInput("");
    await sendMessage(msg, activeProject.id);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  async function switchSession(id: string) {
    if (isStreaming) stop();
    loadSession(id);
    try {
      const history = await fetchHistory(id);
      loadMessages(history);
    } catch {
      toast.error("加载对话历史失败");
      loadMessages([]);
    }
  }

  function handleNewChat() {
    if (isStreaming) stop();
    clear();
  }

  async function handleRename(id: string, currentTitle: string) {
    const title = prompt("重命名对话", currentTitle);
    if (!title?.trim() || title.trim() === currentTitle) return;
    try {
      await renameSession(id, title.trim());
      toast.success("已重命名");
    } catch {
      toast.error("重命名失败，请重试");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("确定删除该对话？删除后不可恢复。")) return;
    try {
      await deleteSession(id);
      toast.success("对话已删除");
      if (id === sessionId) clear();
    } catch {
      toast.error("删除失败，请重试");
    }
  }

  return (
    <section className="flex h-full w-full">
      {/* Session history panel */}
      {showSessions && (
        <aside className="w-64 border-r border-slate-200 bg-white/70 backdrop-blur-sm flex flex-col flex-shrink-0 animate-fadeIn">
          <div className="h-16 flex items-center justify-between px-4 border-b border-slate-100">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
              <History className="w-4 h-4" /> 历史对话
            </div>
            <button
              onClick={() => setShowSessions(false)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"
              title="收起面板"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto scroll-thin p-3 space-y-1">
            {sessionsLoading ? (
              <div className="space-y-2 px-1">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-9 rounded-xl bg-slate-100 animate-pulse" />
                ))}
              </div>
            ) : sessions.length === 0 ? (
              <div className="text-xs text-slate-400 text-center py-10 px-3 leading-relaxed">
                暂无历史对话
                <br />
                发送第一条消息后会自动保存
              </div>
            ) : (
              sessions.map((s) => (
                <div
                  key={s.id}
                  onClick={() => s.id !== sessionId && switchSession(s.id)}
                  className={`group flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer text-sm transition-all ${
                    s.id === sessionId
                      ? "bg-indigo-50 text-indigo-700 font-semibold border border-indigo-100"
                      : "text-slate-600 hover:bg-slate-100 border border-transparent"
                  }`}
                >
                  <MessageSquare className="w-4 h-4 flex-shrink-0 opacity-60" />
                  <span className="truncate flex-1">{s.title}</span>
                  <span className="hidden group-hover:flex items-center gap-0.5 flex-shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRename(s.id, s.title);
                      }}
                      className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all"
                      title="重命名"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(s.id);
                      }}
                      className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all"
                      title="删除"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </span>
                </div>
              ))
            )}
          </div>
        </aside>
      )}

      {/* Main chat column */}
      <section className="flex flex-col h-full flex-1 min-w-0">
        {/* Header */}
        <header className="h-16 border-b border-slate-200 bg-white/50 backdrop-blur-md flex items-center justify-between px-8 flex-shrink-0">
          <div className="flex items-center gap-3">
            {!showSessions && (
              <button
                onClick={() => setShowSessions(true)}
                className="p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
                title="展开历史对话"
              >
                <History className="w-4 h-4" />
              </button>
            )}
            <h2 className="font-bold text-slate-800">多 Agent 协同中心</h2>
          </div>
          <div className="flex items-center gap-4 text-xs font-medium">
            <div className="flex items-center gap-3 text-slate-400">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-blue-500" />文献专家
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-500" />联网搜索
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-purple-500" />模型推理
              </span>
            </div>
            <button
              onClick={handleNewChat}
              className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg font-bold text-slate-700 hover:border-indigo-500 hover:text-indigo-600 transition-all"
              title="开始新对话"
            >
              <Plus className="w-4 h-4" /> 新对话
            </button>
            <button className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg font-bold text-slate-700 hover:border-blue-500 transition-all">
              <Table className="w-4 h-4" /> 提取矩阵
            </button>
          </div>
        </header>

        {/* Chat Messages */}
        <div ref={scrollRef} className="flex-1 chat-container p-10 space-y-10">
          {/* Agent Timeline */}
          <AgentTimeline events={agentTimeline} />

          {/* Welcome message when empty */}
          {messages.length === 0 && (
            <div className="flex gap-4 mb-8 animate-fadeInUp">
              <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-white shadow-xl flex-shrink-0">
                <Zap className="w-5 h-5" />
              </div>
              <div className="max-w-[80%] bg-white border border-slate-200 p-6 rounded-3xl rounded-tl-none shadow-sm space-y-4">
                <p className="text-slate-700 leading-relaxed text-sm">
                  CiteWise 协同系统已就绪。我将自动调度 Agent 为您服务。您可以尝试询问：&ldquo;总结当前文献中关于 Transformer 的应用趋势，并补充最新的联网进展。&rdquo;
                </p>
              </div>
            </div>
          )}

          {/* Messages */}
          {messages.map((msg, i) => (
            <MessageBubble
              key={i}
              message={msg}
              onRegenerate={
                i === messages.length - 1 && msg.role === "assistant" && !isStreaming && activeProject
                  ? () => regenerate(activeProject.id)
                  : undefined
              }
            />
          ))}
        </div>

        {/* Input Bar */}
        <div className="h-24 px-8 flex items-center bg-white border-t border-slate-200 shadow-[0_-4px_12px_rgba(0,0,0,0.02)] flex-shrink-0">
          <div className="w-full max-w-5xl mx-auto relative flex items-center gap-2">
            <div className="shrink-0 flex items-center gap-2">
              <span className="px-2 py-1 bg-indigo-50 text-indigo-600 rounded-md text-[10px] font-bold border border-indigo-100 uppercase">
                Multi-Agent
              </span>
            </div>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="描述您的学术研究任务..."
              disabled={!activeProject}
              className="flex-1 bg-slate-100/80 border border-slate-200 rounded-2xl py-4 px-4 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
            {isStreaming ? (
              <button
                onClick={stop}
                className="shrink-0 bg-red-500 text-white px-5 py-2.5 rounded-xl hover:bg-red-600 shadow-md transition-all active:scale-95 flex items-center gap-2"
              >
                <span className="text-xs font-bold">停止</span>
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!input.trim() || !activeProject}
                className="shrink-0 bg-indigo-600 text-white px-5 py-2.5 rounded-xl hover:bg-indigo-700 shadow-md transition-all active:scale-95 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="text-xs font-bold">学术调度</span>
                <Zap className="w-4 h-4" />
              </button>
            )}
            <ModelSelector value={model} onChange={setModel} />
          </div>
        </div>
      </section>
    </section>
  );
}
