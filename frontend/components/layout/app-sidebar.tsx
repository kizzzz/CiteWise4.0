"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sparkles,
  Layers,
  Lightbulb,
  FileText,
  Share2,
  Send,
  Puzzle,
  Cpu,
  Plus,
  Settings,
  ChevronDown,
  Search,
  PenTool,
  Hammer,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useProject } from "@/hooks/use-project";
import { api } from "@/lib/api-client";
import type { Project } from "@/types";

const navItems = [
  { title: "协同中心", href: "/chat", icon: Sparkles, color: "text-indigo-500" },
  { title: "章节草稿", href: "/draft", icon: Layers, color: "" },
  { title: "文献推荐", href: "/recommendations", icon: Lightbulb, color: "" },
  { title: "文献索引", href: "/papers", icon: FileText, color: "" },
  { title: "知识地图", href: "/knowledge-map", icon: Share2, color: "" },
  { title: "论文投递", href: "/submit", icon: Send, color: "" },
];

const extItems = [
  { title: "扩展市场", href: "/extensions", icon: Puzzle, color: "text-amber-500" },
  { title: "Agent 中心", href: "/agents", icon: Cpu, color: "text-indigo-500" },
];

const defaultAgents = [
  { name: "Research", icon: "search", status: "READY", color: "blue" },
  { name: "Writing", icon: "pen-tool", status: "READY", color: "purple" },
  { name: "Analyst", icon: "hammer", status: "READY", color: "slate" },
];

interface AppSidebarProps {
  projectName?: string | null;
  onNewProject?: () => void;
}

export function AppSidebar({ projectName, onNewProject }: AppSidebarProps) {
  const pathname = usePathname();
  const { user } = useAuth();
  const { projects, activeProject, selectProject } = useProject();
  const [projectOpen, setProjectOpen] = useState(false);
  const [agents, setAgents] = useState(defaultAgents);

  const username = user?.user_metadata?.username || user?.email?.split("@")[0] || "未登录";
  const avatarLetter = username.charAt(0).toUpperCase();

  function isActive(href: string) {
    return pathname === href || pathname?.startsWith(href + "/");
  }

  return (
    <aside className="w-72 glass-sidebar flex flex-col h-full z-10 shadow-xl text-sm border-r border-slate-200">
      <div className="p-6 flex-1 overflow-y-auto scroll-thin">
        {/* Brand */}
        <div className="flex items-center gap-2 mb-10 group cursor-default">
          <div className="gemini-logo">
            <svg viewBox="0 0 24 24" className="sparkle-icon" width="28" height="28">
              <path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z" />
            </svg>
          </div>
          <h1 className="brand-name">CiteWise</h1>
        </div>

        <div className="space-y-8">
          {/* Navigation: Academic Core */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block ml-1">
              学术核心
            </label>
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl font-semibold transition-all text-left ${
                    active
                      ? "bg-blue-50 text-blue-700"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <Icon className={`w-4 h-4 ${active ? "text-blue-600" : item.color || ""}`} />
                  {item.title}
                </Link>
              );
            })}
          </div>

          {/* Navigation: Extended Capabilities */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block ml-1">
              扩展能力
            </label>
            {extItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl font-semibold transition-all text-left ${
                    active
                      ? "bg-blue-50 text-blue-700"
                      : `${item.color} hover:bg-slate-100`
                  }`}
                >
                  <Icon className={`w-4 h-4 ${active ? "text-blue-600" : ""}`} />
                  {item.title}
                </Link>
              );
            })}
          </div>

          {/* Agent Status */}
          <div className="space-y-1 pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between mb-3 pr-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block ml-1">
                子 Agent 状态
              </label>
              <button className="w-5 h-5 flex items-center justify-center bg-slate-100 text-slate-500 rounded hover:bg-indigo-600 hover:text-white transition-all shadow-sm">
                <Plus className="w-3 h-3" />
              </button>
            </div>
            <div className="space-y-2">
              {agents.map((agent) => {
                const Icon = agent.icon === "search" ? Search : agent.icon === "pen-tool" ? PenTool : Hammer;
                return (
                  <div
                    key={agent.name}
                    className="flex items-center justify-between p-2 px-3 bg-slate-50/50 rounded-lg border border-slate-100 text-[11px] cursor-pointer hover:bg-indigo-50 hover:border-indigo-100 transition-all"
                  >
                    <span className="flex items-center gap-2">
                      <Icon className={`w-3 h-3 text-${agent.color}-500`} />
                      {agent.name}
                    </span>
                    <span className={`font-bold uppercase text-[9px] ${agent.status === "RUNNING" ? "text-amber-500" : "text-green-500"}`}>
                      {agent.status}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Project Management */}
          <div className="relative pt-4 border-t border-slate-100">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block ml-1">
              项目管理
            </label>
            <div
              className="mt-2 bg-white border border-slate-200 rounded-xl p-3 flex items-center justify-between cursor-pointer hover:border-blue-400 transition-all shadow-sm"
              onClick={() => setProjectOpen((prev) => !prev)}
            >
              <span className="text-sm font-semibold text-slate-700 truncate">
                {activeProject?.name ?? "选择项目..."}
              </span>
              <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${projectOpen ? "rotate-180" : ""}`} />
            </div>
            {projectOpen && (
              <div className="mt-2 p-1 bg-white border border-slate-200 rounded-xl shadow-lg">
                <div className="max-h-48 overflow-y-auto">
                  {projects.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => {
                        selectProject(p);
                        setProjectOpen(false);
                      }}
                      className={`p-2.5 text-sm font-medium rounded-lg cursor-pointer transition-all ${
                        activeProject?.id === p.id
                          ? "bg-blue-50 text-blue-700"
                          : "text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {p.name}
                    </div>
                  ))}
                </div>
                <div className="border-t border-slate-100 my-1" />
                <div
                  onClick={() => {
                    onNewProject?.();
                    setProjectOpen(false);
                  }}
                  className="p-2.5 text-sm text-blue-600 font-bold hover:bg-blue-50 rounded-lg cursor-pointer flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" /> 新建研究项目
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* User Profile Card */}
      <div className="p-4 border-t border-slate-100 bg-slate-50/30">
        <Link
          href="/settings"
          className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-white transition-all text-left group"
        >
          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-500 to-blue-400 flex items-center justify-center text-white font-bold text-sm shadow-md">
            {avatarLetter}
          </div>
          <div className="flex-1">
            <p className="font-bold text-slate-700">{username}</p>
            <p className="text-slate-400 uppercase tracking-tighter text-[10px]">
              {user ? "Researcher" : "Guest"}
            </p>
          </div>
          <Settings className="w-3.5 h-3.5 text-slate-300" />
        </Link>
      </div>
    </aside>
  );
}
