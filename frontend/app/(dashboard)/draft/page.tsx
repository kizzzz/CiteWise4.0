"use client";

import { useState, useEffect, useCallback } from "react";
import {
  FileText,
  Plus,
  Download,
  Sparkles,
  Trash2,
  ArrowLeft,
  Bookmark,
  Send,
} from "lucide-react";
import { useProject } from "@/hooks/use-project";
import { api, getAuthToken, API_BASE } from "@/lib/api-client";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

interface Section {
  id: string;
  title: string;
  content: string;
  order_index: number;
  status: string;
  sources: { title: string; citation: string }[];
}

interface SubMessage {
  role: "user" | "assistant";
  content: string;
}

export default function DraftPage() {
  const { activeProject } = useProject();
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [generating, setGenerating] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [activeSection, setActiveSection] = useState<Section | null>(null);
  const [materialsOpen, setMaterialsOpen] = useState(false);
  const [subMessages, setSubMessages] = useState<SubMessage[]>([]);
  const [subInput, setSubInput] = useState("");

  const loadSections = useCallback(async () => {
    if (!activeProject) return;
    try {
      const data = await api.get<Section[]>(`/sections/?project_id=${activeProject.id}`);
      setSections(data);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? `章节加载失败：${err.message}` : "章节加载失败，请刷新重试");
    } finally { setLoading(false); }
  }, [activeProject]);

  useEffect(() => { loadSections(); }, [loadSections]);

  function openEditor(section: Section) {
    setActiveSection(section);
    setShowEditor(true);
    setSubMessages([]);
  }

  function closeEditor() {
    setShowEditor(false);
    setActiveSection(null);
    setSubMessages([]);
  }

  async function addSection() {
    if (!activeProject) return;
    const title = prompt("章节标题");
    if (!title) return;
    try {
      const section = await api.post<Section>("/sections/", { title, order_index: sections.length });
      setSections((prev) => [...prev, section]);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? `创建失败：${err.message}` : "创建章节失败，请重试");
    }
  }

  async function generateContent(sectionId: string) {
    setGenerating(sectionId);
    try {
      const result = await api.post<{ content: string; sources: { title: string; citation: string }[] }>("/sections/generate", {
        section_id: sectionId, target_words: 1000,
      });
      setSections((prev) =>
        prev.map((s) => (s.id === sectionId ? { ...s, content: result.content, status: "generated", sources: result.sources } : s))
      );
      if (activeSection?.id === sectionId) {
        setActiveSection((prev) => prev ? { ...prev, content: result.content, status: "generated" } : prev);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? `生成失败：${err.message}` : "内容生成失败，请重试");
    } finally { setGenerating(null); }
  }

  async function saveContent(section: Section) {
    try {
      await api.patch(`/sections/${section.id}`, { content: section.content });
    } catch {
      toast.error("保存失败，请重试");
    }
  }

  async function deleteSection(id: string) {
    try {
      await api.delete(`/sections/${id}`);
      setSections((prev) => prev.filter((s) => s.id !== id));
      if (activeSection?.id === id) closeEditor();
    } catch {
      toast.error("删除章节失败，请重试");
    }
  }

  async function exportDraft(format: string) {
    if (!activeProject) return;
    try {
      const token = await getAuthToken();
      const res = await fetch(
        `${API_BASE}/sections/export`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ project_id: activeProject.id, format }),
        }
      );
      if (!res.ok) {
        toast.error(`导出失败 (${res.status})，请重试`);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = format === "docx" ? "draft.docx" : "draft.md";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("导出成功");
    } catch {
      toast.error("导出失败，请检查网络后重试");
    }
  }

  async function smartExpand() {
    if (!activeSection) return;
    setGenerating(activeSection.id);
    try {
      const result = await api.post<{ content: string }>("/sections/generate", {
        section_id: activeSection.id, target_words: 500,
      });
      const newContent = activeSection.content + "\n\n" + result.content;
      setActiveSection((prev) => prev ? { ...prev, content: newContent } : prev);
      setSections((prev) =>
        prev.map((s) => (s.id === activeSection.id ? { ...s, content: newContent } : s))
      );
    } catch (err: unknown) {
      toast.error(err instanceof Error ? `扩写失败：${err.message}` : "扩写失败，请重试");
    } finally { setGenerating(null); }
  }

  function handleSubSend() {
    if (!subInput.trim()) return;
    const userMsg: SubMessage = { role: "user", content: subInput };
    setSubMessages((prev) => [...prev, userMsg]);
    setSubInput("");
    // Simulated AI response for now
    setTimeout(() => {
      setSubMessages((prev) => [...prev, { role: "assistant", content: "已收到您的指令，正在处理..." }]);
    }, 500);
  }

  // Section list view
  if (!showEditor) {
    return (
      <section className="flex flex-col h-full w-full">
        <header className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-8 flex-shrink-0">
          <h2 className="font-bold text-slate-800">章节管理</h2>
          <div className="flex gap-2">
            <button onClick={() => exportDraft("markdown")} className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:border-blue-400 transition-all">
              <Download className="w-4 h-4 inline mr-1" /> MD
            </button>
            <button onClick={() => exportDraft("docx")} className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:border-blue-400 transition-all">
              <Download className="w-4 h-4 inline mr-1" /> DOCX
            </button>
            <button onClick={addSection} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-blue-700 transition-all">
              新建章节
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-8">
          {loading ? (
            <div className="grid grid-cols-2 gap-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="interactive-card bg-white rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-3">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-4 w-12 rounded-full" />
                  </div>
                  <Skeleton className="h-3 w-full mb-2" />
                  <Skeleton className="h-3 w-5/6 mb-2" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
              ))}
            </div>
          ) : sections.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <FileText className="w-12 h-12 mb-4 text-slate-300" />
              <p className="text-sm">暂无章节，点击"新建章节"开始写作</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-6">
              {sections.map((section) => (
                <div
                  key={section.id}
                  className="interactive-card bg-white rounded-2xl p-6 cursor-pointer group"
                  onClick={() => openEditor(section)}
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-slate-800">{section.title}</h3>
                    <div className="flex items-center gap-1">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        section.status === "generated"
                          ? "bg-green-50 text-green-600"
                          : "bg-slate-100 text-slate-400"
                      }`}>
                        {section.status === "generated" ? "已生成" : "草稿"}
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteSection(section.id); }}
                        className="opacity-0 group-hover:opacity-100 p-1 text-slate-300 hover:text-red-500 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 line-clamp-3">
                    {section.content || "点击编辑或使用 AI 生成..."}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    );
  }

  // Editor view
  return (
    <section className="flex flex-col h-full w-full animate-fadeIn">
      <header className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-8 flex-shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={closeEditor} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h3 className="text-sm font-bold text-slate-800">{activeSection?.title || "编辑"}</h3>
        </div>
        <div className="flex gap-2">
          <button
            onClick={smartExpand}
            disabled={generating === activeSection?.id}
            className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 shadow-md disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5 inline mr-1" />
            {generating === activeSection?.id ? "生成中..." : "智能续写"}
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Main editing area */}
        <div className="flex-1 p-12 overflow-y-auto scroll-thin bg-white">
          <div
            contentEditable
            suppressContentEditableWarning
            onBlur={(e) => {
              const newContent = e.currentTarget.innerText;
              if (activeSection) {
                setActiveSection((prev) => prev ? { ...prev, content: newContent } : prev);
                saveContent({ ...activeSection, content: newContent });
              }
            }}
            className="max-w-3xl mx-auto text-slate-700 leading-loose text-lg outline-none min-h-full"
          >
            {activeSection?.content || ""}
          </div>
        </div>

        {/* Collaboration sidebar */}
        <div className="w-96 border-l border-slate-200 bg-slate-50/50 flex flex-col flex-shrink-0">
          {/* Materials toggle */}
          <div className="px-4 pt-3 flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">协作面板</span>
            <button
              onClick={() => setMaterialsOpen((prev) => !prev)}
              className="text-[10px] font-bold text-indigo-500 hover:text-indigo-700 flex items-center gap-1"
            >
              <Bookmark className="w-3 h-3" /> 素材 ({activeSection?.sources?.length || 0})
            </button>
          </div>

          {/* Materials panel */}
          {materialsOpen && (
            <div className="px-4 py-2 space-y-2 max-h-40 overflow-y-auto border-b border-slate-200">
              {activeSection?.sources && activeSection.sources.length > 0 ? (
                activeSection.sources.map((src, i) => (
                  <div key={i} className="bg-white border border-slate-100 rounded-lg p-2.5 text-xs">
                    <p className="font-semibold text-slate-700">{src.title}</p>
                    <p className="text-slate-400 mt-0.5">{src.citation}</p>
                  </div>
                ))
              ) : (
                <p className="text-[10px] text-slate-400 py-2">暂无素材</p>
              )}
            </div>
          )}

          {/* Sub-chat window */}
          <div className="flex-1 p-4 overflow-y-auto scroll-thin space-y-4">
            {subMessages.length === 0 && (
              <p className="text-[10px] text-slate-400 text-center py-8">在下方输入指令进行AI辅助编辑</p>
            )}
            {subMessages.map((msg, i) => (
              <div key={i} className={`sub-bubble ${msg.role === "user" ? "sub-bubble-user" : "sub-bubble-ai"}`}>
                {msg.content}
              </div>
            ))}
          </div>

          {/* Sub-chat input */}
          <div className="p-4 bg-white border-t border-slate-200">
            <div className="relative">
              <textarea
                value={subInput}
                onChange={(e) => setSubInput(e.target.value)}
                rows={2}
                placeholder="指令修稿..."
                className="w-full bg-slate-100 border-none rounded-xl p-3 text-xs focus:ring-2 focus:ring-blue-500 resize-none outline-none"
              />
              <button
                onClick={handleSubSend}
                className="absolute right-2 bottom-2 p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
