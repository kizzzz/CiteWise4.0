"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Cpu, RefreshCw, FolderOpen,
  CheckCircle, Target, AlertTriangle, Clock, Coins,
} from "lucide-react";
import { toast } from "sonner";
import { useProject } from "@/hooks/use-project";
import { api } from "@/lib/api-client";

interface AgentConfig {
  id: string;
  name: string;
  status: "active" | "idle" | "error";
  skills_count: number;
  color: string;
}

const defaultAgents: AgentConfig[] = [
  { id: "researcher", name: "Researcher", status: "active", skills_count: 3, color: "bg-blue-500" },
  { id: "writer", name: "Writer", status: "idle", skills_count: 2, color: "bg-purple-500" },
  { id: "analyst", name: "Analyst", status: "idle", skills_count: 1, color: "bg-slate-400" },
];

const evalMetricDefs = [
  { key: "successRate", label: "任务成功率", icon: CheckCircle, iconColor: "text-blue-600", bgColor: "bg-blue-50", unit: "%" },
  { key: "accuracy", label: "引用准确率", icon: Target, iconColor: "text-emerald-600", bgColor: "bg-emerald-50", unit: "%" },
  { key: "hallucRate", label: "幻觉率", icon: AlertTriangle, iconColor: "text-red-500", bgColor: "bg-red-50", unit: "%" },
  { key: "responseTime", label: "响应时间", icon: Clock, iconColor: "text-amber-600", bgColor: "bg-amber-50", unit: "ms" },
  { key: "cost", label: "调用成本", icon: Coins, iconColor: "text-purple-600", bgColor: "bg-purple-50", unit: "$" },
];

interface EvalSummary {
  total: number;
  metrics: Record<string, { avg: number; count: number; latest: number }>;
  trend: { metric: string; score: number; created_at: string }[];
}

export default function AgentsPage() {
  const { activeProject } = useProject();
  const [tab, setTab] = useState<"config" | "eval">("config");
  const [agents] = useState(defaultAgents);
  const [evalData, setEvalData] = useState<Record<string, { value: number; detail: string }> | null>(null);
  const [evalTotal, setEvalTotal] = useState(0);
  const [trendData, setTrendData] = useState<{ day: string; value: number }[]>([]);
  const [loading, setLoading] = useState(false);
  const [days, setDays] = useState(7);

  const loadEval = useCallback(async () => {
    if (!activeProject) {
      setEvalData(null);
      setEvalTotal(0);
      setTrendData([]);
      return;
    }
    setLoading(true);
    try {
      const data = await api.get<EvalSummary>(`/settings/eval/summary?project_id=${activeProject.id}`);
      if (data && data.metrics) {
        const mapped: Record<string, { value: number; detail: string }> = {};
        for (const [name, val] of Object.entries(data.metrics)) {
          mapped[name] = { value: Math.round((val.avg ?? 0) * 100) / 100, detail: `${val.count ?? 0} 次评估` };
        }
        setEvalData(mapped);
        setEvalTotal(data.total ?? 0);

        const cutoff = Date.now() - days * 86400000;
        const byDay = new Map<string, { sum: number; count: number }>();
        for (const t of data.trend || []) {
          const ts = new Date(t.created_at).getTime();
          if (Number.isNaN(ts) || ts < cutoff) continue;
          const d = new Date(ts);
          const key = `${d.getMonth() + 1}/${d.getDate()}`;
          const prev = byDay.get(key) ?? { sum: 0, count: 0 };
          byDay.set(key, { sum: prev.sum + t.score, count: prev.count + 1 });
        }
        setTrendData(
          [...byDay.entries()].map(([day, v]) => ({ day, value: Math.round((v.sum / v.count) * 10) / 10 }))
        );
      } else {
        setEvalData(null);
        setEvalTotal(0);
        setTrendData([]);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? `评估数据加载失败：${err.message}` : "评估数据加载失败，请重试");
    } finally {
      setLoading(false);
    }
  }, [activeProject, days]);

  useEffect(() => { if (tab === "eval") loadEval(); }, [tab, loadEval]);

  const insights = useMemo(() => {
    if (!evalData || evalTotal === 0) {
      return [{ priority: "low", text: "暂无评估数据，系统运行后会逐步积累指标记录" }];
    }
    const out: { priority: string; text: string }[] = [
      { priority: "medium", text: `已累计 ${evalTotal} 次评估，覆盖 ${Object.keys(evalData).length} 项指标` },
    ];
    const rt = evalData.responseTime;
    if (rt && rt.value > 3000) {
      out.push({ priority: "high", text: `平均响应 ${rt.value}ms 偏高，建议精简检索范围或启用并行检索` });
    }
    const acc = evalData.accuracy;
    if (acc && acc.value < 80) {
      out.push({ priority: "high", text: `引用准确率 ${acc.value}，建议上传更多文献提升知识库覆盖` });
    }
    const halluc = evalData.hallucRate;
    if (halluc && halluc.value > 10) {
      out.push({ priority: "medium", text: `幻觉率 ${halluc.value}，建议开启来源标注校验` });
    }
    if (out.length === 1) {
      out.push({ priority: "low", text: "各项指标处于健康区间，继续保持" });
    }
    return out;
  }, [evalData, evalTotal]);

  return (
    <section className="flex flex-col h-full w-full text-sm">
      <header className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-8 flex-shrink-0">
        <div className="flex items-center gap-4">
          <h2 className="font-bold text-slate-800">Agent 中心</h2>
          {tab === "eval" && (
            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-1 rounded-md uppercase">5 大核心指标</span>
          )}
          <div className="flex bg-slate-100 rounded-lg p-0.5">
            <button
              onClick={() => setTab("config")}
              className={`ext-tab-btn px-4 py-1.5 rounded-md text-xs font-bold transition-all ${tab === "config" ? "active" : ""}`}
            >
              配置
            </button>
            <button
              onClick={() => setTab("eval")}
              className={`ext-tab-btn px-4 py-1.5 rounded-md text-xs font-bold transition-all ${tab === "eval" ? "active" : ""}`}
            >
              评估
            </button>
          </div>
        </div>
        {tab === "config" && (
          <span className="text-[10px] font-bold px-3 py-1.5 rounded-md bg-indigo-50 text-indigo-600 border border-indigo-100">
            LangGraph 内置架构 · {agents.length} Agent
          </span>
        )}
        {tab === "eval" && (
          <div className="flex items-center gap-2">
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-600 focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value={7}>近 7 天</option>
              <option value={14}>近 14 天</option>
              <option value={30}>近 30 天</option>
            </select>
            <button onClick={loadEval} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-all" title="刷新评估数据">
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        )}
      </header>

      {/* Config Tab */}
      {tab === "config" && (
        <div className="flex-1 overflow-auto p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {agents.map((agent) => (
              <div key={agent.id} className="interactive-card bg-white rounded-2xl p-5">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl ${agent.color} flex items-center justify-center text-white shadow-md`}>
                    <Cpu className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-slate-800">{agent.name}</h3>
                      <span className={`w-2 h-2 rounded-full ${
                        agent.status === "active" ? "bg-green-500" : agent.status === "idle" ? "bg-slate-300" : "bg-red-500"
                      }`} />
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {agent.skills_count} 个技能 · {agent.status === "active" ? "运行中" : agent.status === "idle" ? "空闲" : "异常"}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Eval Tab */}
      {tab === "eval" && (
        <div className="flex-1 overflow-auto p-8 space-y-8">
          {!activeProject && (
            <div className="flex items-center gap-3 bg-amber-50 border border-amber-100 text-amber-700 rounded-xl px-5 py-4 text-sm">
              <FolderOpen className="w-4 h-4 flex-shrink-0" />
              请先选择或创建项目，评估数据将按项目维度记录与展示
            </div>
          )}
          {/* Metrics Grid - 5 columns like v3 */}
          <div className="grid grid-cols-5 gap-5">
            {evalMetricDefs.map((metric) => {
              const Icon = metric.icon;
              const data = evalData?.[metric.key];
              return (
                <div key={metric.key} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`w-8 h-8 rounded-lg ${metric.bgColor} flex items-center justify-center`}>
                      <Icon className={`w-4 h-4 ${metric.iconColor}`} />
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">{metric.label}</span>
                  </div>
                  <div className="text-3xl font-extrabold text-slate-900">
                    {data ? `${data.value}${metric.unit}` : "--"}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    {data?.detail || "暂无数据"}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Trend Chart + Suggestions */}
          <div className="grid grid-cols-3 gap-6">
            {/* Bar Chart */}
            <div className="col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <h3 className="text-sm font-bold text-slate-800 mb-4">每日评估趋势 <span className="text-[10px] font-normal text-slate-400 ml-1">近 {days} 天 · 按日均分值</span></h3>
              {trendData.length > 0 ? (
                <div className="h-48 flex items-end gap-2">
                  {trendData.map((d, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div
                        className="w-full bg-indigo-500 rounded-t-md transition-all hover:bg-indigo-600"
                        style={{ height: `${d.value}%` }}
                        title={`${d.value}%`}
                      />
                      <span className="text-[9px] text-slate-400">{d.day}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-48 bg-slate-50 rounded-xl flex items-center justify-center text-slate-300 text-xs">
                  暂无趋势数据
                </div>
              )}
            </div>

            {/* Suggestions */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <h3 className="text-sm font-bold text-slate-800 mb-4">数据洞察</h3>
              <div className="space-y-3 text-sm">
                {insights.map((s, i) => (
                  <div key={i} className={`p-3 rounded-xl border-l-4 ${
                    s.priority === "high" ? "border-l-red-500 bg-red-50" :
                    s.priority === "medium" ? "border-l-amber-500 bg-amber-50" :
                    "border-l-blue-500 bg-blue-50"
                  }`}>
                    <p className="text-xs text-slate-600">{s.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
