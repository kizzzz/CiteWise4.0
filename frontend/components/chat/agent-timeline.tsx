"use client";

import type { AgentEvent } from "@/hooks/use-chat-stream";

const agentColors: Record<string, string> = {
  Researcher: "border-blue-500 bg-blue-500",
  Writer: "border-purple-500 bg-purple-500",
  Analyst: "border-slate-400 bg-slate-400",
  Router: "border-indigo-500 bg-indigo-500",
};

function getAgentColor(agent: string): string {
  return agentColors[agent] || "border-slate-300 bg-slate-300";
}

interface AgentTimelineProps {
  events: AgentEvent[];
}

export function AgentTimeline({ events }: AgentTimelineProps) {
  if (events.length === 0) return null;

  const latestByAgent = new Map<string, AgentEvent>();
  for (const ev of events) {
    latestByAgent.set(ev.agent, ev);
  }
  const uniqueAgents = Array.from(latestByAgent.values());

  return (
    <div className="border border-slate-200 rounded-xl p-4 mb-4 bg-white/80 backdrop-blur-sm animate-slideInLeft">
      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Agent 时间线</p>
      <div className="space-y-0">
        {uniqueAgents.map((ev, i) => {
          const colors = getAgentColor(ev.agent).split(" ");
          const borderColor = colors[0];

          return (
            <div key={`${ev.agent}-${i}`} className="collab-step">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold ${borderColor.replace("border-", "text-")}`}>
                  {ev.agent}
                </span>
                <span className="text-[10px] text-slate-400">{ev.detail}</span>
                {ev.duration_ms && (
                  <span className="text-[10px] text-slate-300 ml-auto">{ev.duration_ms}ms</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
