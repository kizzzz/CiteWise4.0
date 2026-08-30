"use client";

import { useState } from "react";
import { Send, AlertCircle, ExternalLink, RefreshCw } from "lucide-react";
import { useProject } from "@/hooks/use-project";
import { api } from "@/lib/api-client";

export default function SubmitPage() {
  const { activeProject } = useProject();
  const [title, setTitle] = useState("");
  const [abstract, setAbstract] = useState("");
  const [field, setField] = useState("");
  const [journals, setJournals] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"journal" | "format">("journal");
  const [formatJournal, setFormatJournal] = useState("");
  const [formatResults, setFormatResults] = useState<any[]>([]);
  const [formatLoading, setFormatLoading] = useState(false);
  const [journalError, setJournalError] = useState<string | null>(null);

  async function recommend() {
    if (!title.trim()) return;
    setLoading(true);
    setJournalError(null);
    try {
      const data = await api.post<{ journals?: any[] }>("/knowledge/submit", { title, abstract, field });
      setJournals(data.journals || []);
    } catch (err: any) {
      setJournalError(err.message || "推荐失败，请重试");
    } finally { setLoading(false); }
  }

  async function runFormatCheck() {
    if (!formatJournal.trim() || !activeProject) return;
    setFormatLoading(true);
    try {
      const data = await api.post<{ checks?: any[] }>("/knowledge/format-check", {
        journal: formatJournal,
        project_id: activeProject.id,
      });
      setFormatResults(data.checks || []);
    } catch { /* */ } finally { setFormatLoading(false); }
  }

  return (
    <section className="flex flex-col h-full w-full text-sm">
      <header className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-8 flex-shrink-0">
        <div className="flex items-center gap-4">
          <h2 className="font-bold text-slate-800">论文投递</h2>
          <div className="flex bg-slate-100 rounded-lg p-0.5">
            <button
              onClick={() => setTab("journal")}
              className={`ext-tab-btn px-4 py-1.5 rounded-md text-xs font-bold transition-all ${tab === "journal" ? "active" : ""}`}
            >
              推荐期刊
            </button>
            <button
              onClick={() => setTab("format")}
              className={`ext-tab-btn px-4 py-1.5 rounded-md text-xs font-bold transition-all ${tab === "format" ? "active" : ""}`}
            >
              格式检查
            </button>
          </div>
        </div>
      </header>

      {/* Journal Recommendation Tab */}
      {tab === "journal" && (
        <div className="flex-1 overflow-auto p-8">
          {journalError && (
            <div className="flex flex-col items-center justify-center py-12 text-red-400 animate-fadeIn">
              <AlertCircle className="w-12 h-12 mb-4" />
              <p className="text-sm">{journalError}</p>
              <button onClick={() => { setJournalError(null); recommend(); }} className="mt-3 px-4 py-2 text-xs font-bold text-indigo-600 hover:underline">
                重试
              </button>
            </div>
          )}
          {!journalError && journals.length === 0 ? (
            <div className="max-w-3xl mx-auto">
              <div className="space-y-4 mb-6">
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="论文标题"
                  className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
                <textarea
                  value={abstract}
                  onChange={(e) => setAbstract(e.target.value)}
                  placeholder="论文摘要"
                  rows={4}
                  className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                />
                <input
                  value={field}
                  onChange={(e) => setField(e.target.value)}
                  placeholder="研究领域（可选）"
                  className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
                <button
                  onClick={recommend}
                  disabled={loading || !title.trim()}
                  className="w-full py-3 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 shadow-md disabled:opacity-50"
                >
                  {loading ? "推荐中..." : "获取期刊推荐"}
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {journals.map((j: any, i: number) => (
                  <div key={i} className="interactive-card bg-white rounded-2xl p-5">
                    <h3 className="text-sm font-bold text-slate-800 mb-2">{j.name}</h3>
                    {j.reason && <p className="text-xs text-slate-500 mb-3">{j.reason}</p>}
                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      {j.impact_factor && (
                        <div className="bg-blue-50 rounded-lg p-2">
                          <p className="text-slate-400">影响因子</p>
                          <p className="font-bold text-blue-600 text-sm">{j.impact_factor}</p>
                        </div>
                      )}
                      {j.review_time && (
                        <div className="bg-green-50 rounded-lg p-2">
                          <p className="text-slate-400">审稿周期</p>
                          <p className="font-bold text-green-600 text-sm">{j.review_time}</p>
                        </div>
                      )}
                      {j.acceptance_rate && (
                        <div className="bg-purple-50 rounded-lg p-2">
                          <p className="text-slate-400">接受率</p>
                          <p className="font-bold text-purple-600 text-sm">{j.acceptance_rate}</p>
                        </div>
                      )}
                      {j.url && (
                        <div className="bg-slate-50 rounded-lg p-2 flex items-center justify-center">
                          <a href={j.url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 font-bold flex items-center gap-1">
                            <ExternalLink className="w-3 h-3" /> 投稿
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6 text-center">
                <button onClick={() => { setJournals([]); }} className="px-6 py-2 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-bold hover:bg-indigo-100">
                  重新推荐
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Format Check Tab */}
      {tab === "format" && (
        <div className="flex-1 overflow-auto p-8">
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">目标期刊</label>
              <input
                value={formatJournal}
                onChange={(e) => setFormatJournal(e.target.value)}
                placeholder="输入期刊名称，如 Nature, 计算机学报..."
                className="w-full mt-2 border border-slate-200 rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50"
              />
              <button
                onClick={runFormatCheck}
                disabled={formatLoading || !formatJournal.trim()}
                className="mt-3 w-full py-3 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 shadow-md disabled:opacity-50"
              >
                {formatLoading ? "检查中..." : "开始格式检查"}
              </button>
            </div>

            {formatResults.length > 0 && (
              <div className="space-y-3">
                {formatResults.map((check: any, i: number) => {
                  const severity = check.severity || "info";
                  const severityStyles = {
                    error: "border-l-red-500 bg-red-50",
                    warning: "border-l-amber-500 bg-amber-50",
                    info: "border-l-blue-500 bg-blue-50",
                  };
                  return (
                    <div
                      key={i}
                      className={`border-l-4 rounded-r-xl p-4 ${severityStyles[severity as keyof typeof severityStyles] || severityStyles.info}`}
                    >
                      <div className="flex items-center justify-between">
                        <p className="font-bold text-slate-700 text-xs">{check.item || check.name}</p>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          severity === "error" ? "bg-red-100 text-red-600" :
                          severity === "warning" ? "bg-amber-100 text-amber-600" :
                          "bg-blue-100 text-blue-600"
                        }`}>
                          {severity === "error" ? "严重" : severity === "warning" ? "警告" : "通过"}
                        </span>
                      </div>
                      {check.message && <p className="text-xs text-slate-500 mt-1">{check.message}</p>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
