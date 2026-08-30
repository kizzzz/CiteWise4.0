"use client";

import { useState, useEffect, useCallback } from "react";
import { Lightbulb, RefreshCw, AlertCircle, BookOpen } from "lucide-react";
import { useProject } from "@/hooks/use-project";
import { api } from "@/lib/api-client";
import { Skeleton } from "@/components/ui/skeleton";

function getScoreColor(score: number) {
  if (score >= 0.8) return "text-green-600";
  if (score >= 0.5) return "text-amber-600";
  return "text-red-500";
}

function getBarColor(score: number) {
  if (score >= 0.8) return "bg-green-500";
  if (score >= 0.5) return "bg-amber-500";
  return "bg-red-500";
}

export default function RecommendationsPage() {
  const { activeProject } = useProject();
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  async function loadRecommendations() {
    if (!activeProject) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.post<any[]>("/knowledge/recommend", { project_id: activeProject.id, top_k: 10 });
      setResults(Array.isArray(data) ? data : []);
      setLoaded(true);
    } catch (err: any) {
      setError(err.message || "加载失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="flex flex-col h-full w-full">
      <header className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-8 flex-shrink-0">
        <div className="flex items-center gap-4">
          <h2 className="font-bold text-slate-800">文献推荐</h2>
          <span className="text-xs text-slate-400">基于语义相似度与引用网络</span>
        </div>
        <button
          onClick={loadRecommendations}
          disabled={loading}
          className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-bold hover:bg-indigo-100 transition-all flex items-center gap-1.5 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> 刷新推荐
        </button>
      </header>

      <div className="flex-1 overflow-y-auto scroll-thin p-8">
        {/* Loading state */}
        {loading && (
          <div>
            <div className="flex items-center gap-2 mb-6 text-sm text-indigo-500 font-medium">
              <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              正在分析文献关系...
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="interactive-card bg-white rounded-2xl p-5">
                  <Skeleton className="h-4 w-3/4 mb-2" />
                  <Skeleton className="h-3 w-1/2 mb-4" />
                  <Skeleton className="h-2 w-full rounded-full" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error state */}
        {error && !loading && (
          <div className="flex flex-col items-center justify-center py-20 text-red-400">
            <AlertCircle className="w-12 h-12 mb-4" />
            <p className="text-sm">{error}</p>
            <button onClick={loadRecommendations} className="mt-3 px-4 py-2 text-xs font-bold text-indigo-600 hover:underline">重试</button>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && !loaded && (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <BookOpen className="w-12 h-12 mb-4 text-slate-300" />
            <p className="text-sm">选择项目并上传至少 2 篇文献后即可获取推荐</p>
            <button
              onClick={loadRecommendations}
              className="mt-4 px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 shadow-md"
            >
              获取推荐
            </button>
          </div>
        )}

        {/* Results grid */}
        {!loading && !error && loaded && results.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <Lightbulb className="w-12 h-12 mb-4 text-slate-300" />
            <p className="text-sm">暂无推荐结果，请上传更多文献后重试</p>
          </div>
        )}

        {!loading && !error && results.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {results.map((r: any, i: number) => {
              const score = r.score || r.similarity || 0;
              const percent = Math.round(score * 100);
              return (
                <div key={r.id || i} className="interactive-card bg-white rounded-2xl p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold text-slate-800 mb-1 truncate">{r.title || "未命名"}</h3>
                      <p className="text-xs text-slate-400">
                        {r.authors && `${r.authors} · `}{r.year}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={`text-lg font-extrabold ${getScoreColor(score)}`}>{percent}%</p>
                      <p className="text-[10px] text-slate-400 font-bold">匹配度</p>
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div className="mt-3 w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${getBarColor(score)}`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  {r.source_paper && (
                    <p className="text-[10px] text-slate-400 mt-2">
                      来源: {r.source_paper}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
