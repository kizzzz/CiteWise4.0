"use client";

import { Wrench } from "lucide-react";

interface ToolInvocationCardProps {
  toolName: string;
  status: "running" | "completed" | "error";
  detail?: string;
}

export function ToolInvocationCard({ toolName, status, detail }: ToolInvocationCardProps) {
  return (
    <div className="tool-invocation-card">
      <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
        <Wrench className="w-4 h-4" />
      </div>
      <div className="flex-1">
        <p className="text-xs font-bold text-slate-700">{toolName}</p>
        {detail && <p className="text-[10px] text-slate-400 mt-0.5">{detail}</p>}
      </div>
      <span
        className={`text-[10px] font-bold px-2 py-1 rounded-full ${
          status === "running"
            ? "bg-blue-50 text-blue-600"
            : status === "completed"
            ? "bg-green-50 text-green-600"
            : "bg-red-50 text-red-600"
        }`}
      >
        {status === "running" ? "执行中" : status === "completed" ? "完成" : "失败"}
      </span>
    </div>
  );
}
