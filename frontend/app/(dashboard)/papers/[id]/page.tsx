"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, BookmarkPlus, FileText, Calendar, Users, Hash, Clock } from "lucide-react";
import { api } from "@/lib/api-client";

interface PaperSection {
  title: string;
  level: string;
  text: string;
}

interface PaperDetail {
  id: string;
  title: string | null;
  authors: string | null;
  year: number | null;
  filename: string | null;
  chunk_count: number;
  indexed_at: string;
  abstract: string;
  sections: PaperSection[];
  full_text: string;
}

export default function PaperDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [paper, setPaper] = useState<PaperDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"sections" | "fulltext">("sections");

  useEffect(() => {
    async function load() {
      try {
        const data = await api.get<PaperDetail>(`/papers/${params.id}`);
        setPaper(data);
      } catch { /* */ } finally { setLoading(false); }
    }
    if (params.id) load();
  }, [params.id]);

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <header className="h-16 border-b border-slate-200 bg-white flex items-center px-8 flex-shrink-0">
          <div className="text-slate-400 text-sm">加载中...</div>
        </header>
      </div>
    );
  }

  if (!paper) {
    return (
      <div className="flex flex-col h-full">
        <header className="h-16 border-b border-slate-200 bg-white flex items-center px-8 flex-shrink-0">
          <button onClick={() => router.push("/papers")} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span className="text-sm text-slate-400 ml-4">论文未找到</span>
        </header>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full animate-fadeIn">
      {/* Header */}
      <header className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-8 flex-shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push("/papers")} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h3 className="text-sm font-bold text-slate-800">{paper.title || "文献详情"}</h3>
        </div>
        <button className="flex items-center gap-2 px-3 py-2 bg-indigo-50 text-indigo-600 rounded-lg font-bold text-xs hover:bg-indigo-100 transition-all">
          <BookmarkPlus className="w-4 h-4" /> 加入写作素材
        </button>
      </header>

      {/* Content */}
      <div className="flex-1 p-12 overflow-y-auto scroll-thin bg-white">
        <div className="max-w-3xl mx-auto space-y-6">
          <h1 className="text-3xl font-extrabold text-slate-900 leading-tight">
            {paper.title || "未命名"}
          </h1>
          <p className="text-slate-500 font-medium">{paper.authors || "未知作者"}</p>

          {/* Meta badges */}
          <div className="flex flex-wrap gap-2 text-xs">
            {paper.year && (
              <span className="flex items-center gap-1 px-2.5 py-1 bg-slate-100 rounded-full font-semibold text-slate-600">
                <Calendar className="w-3 h-3" /> {paper.year}
              </span>
            )}
            {paper.filename && (
              <span className="flex items-center gap-1 px-2.5 py-1 bg-slate-100 rounded-full font-semibold text-slate-600">
                <FileText className="w-3 h-3" /> {paper.filename}
              </span>
            )}
            <span className="flex items-center gap-1 px-2.5 py-1 bg-slate-100 rounded-full font-semibold text-slate-600">
              <Hash className="w-3 h-3" /> {paper.chunk_count} 片段
            </span>
            <span className="flex items-center gap-1 px-2.5 py-1 bg-slate-100 rounded-full font-semibold text-slate-600">
              <Clock className="w-3 h-3" /> {new Date(paper.indexed_at).toLocaleDateString("zh-CN")}
            </span>
          </div>

          <hr className="border-slate-200" />

          {/* Tabs */}
          <div className="flex bg-slate-100 rounded-lg p-0.5">
            <button
              onClick={() => setActiveTab("sections")}
              className={`ext-tab-btn px-4 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === "sections" ? "active" : ""}`}
            >
              章节
            </button>
            <button
              onClick={() => setActiveTab("fulltext")}
              className={`ext-tab-btn px-4 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === "fulltext" ? "active" : ""}`}
            >
              全文
            </button>
          </div>

          {activeTab === "sections" && (
            <div className="prose prose-slate max-w-none text-slate-700 leading-relaxed space-y-4">
              {paper.abstract && (
                <div className="bg-slate-50 rounded-xl p-4">
                  <h4 className="font-bold text-sm text-slate-500 mb-2">摘要</h4>
                  <p className="text-sm leading-relaxed">{paper.abstract}</p>
                </div>
              )}
              {paper.sections.map((section, idx) => (
                <div key={idx} className="border border-slate-100 rounded-xl p-4">
                  <h4 className="font-bold text-sm text-slate-800 mb-2">{section.title}</h4>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{section.text}</p>
                </div>
              ))}
              {!paper.abstract && paper.sections.length === 0 && (
                <p className="text-slate-400 text-center py-8">暂无内容</p>
              )}
            </div>
          )}

          {activeTab === "fulltext" && (
            <div className="prose prose-slate max-w-none text-slate-700 leading-relaxed">
              <pre className="text-sm whitespace-pre-wrap font-sans">{paper.full_text || "暂无全文"}</pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
