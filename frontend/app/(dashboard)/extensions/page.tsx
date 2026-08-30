"use client";

import { useState, useEffect, useCallback } from "react";
import { Wrench, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface SkillItem {
  id: string;
  name: string;
  description: string;
  icon: string;
  installed: boolean;
  assigned_agents: string[];
}

interface ToolItem {
  id: string;
  name: string;
  trigger: string;
  type: "script" | "dynamic";
  assigned_agents: string[];
}

const SKILLS_KEY = "citewise_skills";
const TOOLS_KEY = "citewise_tools";

const defaultSkills: SkillItem[] = [
  { id: "s1", name: "文献综述生成", description: "基于知识库自动生成文献综述段落", icon: "📚", installed: true, assigned_agents: ["Researcher"] },
  { id: "s2", name: "引用格式化", description: "自动将引用转为 APA/MLA/GB-T7714 格式", icon: "📝", installed: true, assigned_agents: ["Writer"] },
  { id: "s3", name: "语义去重", description: "检测并合并语义重复的段落", icon: "🔄", installed: false, assigned_agents: [] },
  { id: "s4", name: "趋势分析", description: "基于时间线和主题提取研究趋势", icon: "📈", installed: false, assigned_agents: [] },
];

const defaultTools: ToolItem[] = [
  { id: "t1", name: "PDF 解析器", trigger: "/parse_pdf", type: "script", assigned_agents: ["Researcher"] },
  { id: "t2", name: "网页抓取", trigger: "/scrape", type: "dynamic", assigned_agents: ["Researcher"] },
  { id: "t3", name: "图表生成", trigger: "/generate_chart", type: "script", assigned_agents: ["Analyst"] },
];

function loadStored<T>(key: string, fallback: T[]): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export default function ExtensionsPage() {
  const [tab, setTab] = useState<"skill" | "tool">("skill");
  const [skills, setSkills] = useState<SkillItem[]>(defaultSkills);
  const [tools, setTools] = useState<ToolItem[]>(defaultTools);
  const [installing, setInstalling] = useState<string | null>(null);
  const [skillDialogOpen, setSkillDialogOpen] = useState(false);
  const [toolDialogOpen, setToolDialogOpen] = useState(false);
  const [skillForm, setSkillForm] = useState({ name: "", description: "", icon: "⚡" });
  const [toolForm, setToolForm] = useState({ name: "", trigger: "", type: "script" as "script" | "dynamic" });

  useEffect(() => {
    setSkills(loadStored(SKILLS_KEY, defaultSkills));
    setTools(loadStored(TOOLS_KEY, defaultTools));
  }, []);

  const persistSkills = useCallback((next: SkillItem[]) => {
    setSkills(next);
    localStorage.setItem(SKILLS_KEY, JSON.stringify(next));
  }, []);

  const persistTools = useCallback((next: ToolItem[]) => {
    setTools(next);
    localStorage.setItem(TOOLS_KEY, JSON.stringify(next));
  }, []);

  function installSkill(id: string) {
    setInstalling(id);
    setTimeout(() => {
      persistSkills(skills.map((s) => (s.id === id ? { ...s, installed: true } : s)));
      setInstalling(null);
      toast.success("Skill 已安装");
    }, 800);
  }

  function removeSkill(id: string) {
    persistSkills(skills.map((s) => (s.id === id ? { ...s, installed: false, assigned_agents: [] } : s)));
    toast.success("Skill 已卸载");
  }

  function addSkill() {
    const name = skillForm.name.trim();
    if (!name) return;
    persistSkills([
      { id: `s-${Date.now()}`, name, description: skillForm.description.trim() || "自定义 Skill", icon: skillForm.icon.trim() || "⚡", installed: true, assigned_agents: [] },
      ...skills,
    ]);
    setSkillForm({ name: "", description: "", icon: "⚡" });
    setSkillDialogOpen(false);
    toast.success(`已安装「${name}」`);
  }

  function addTool() {
    const name = toolForm.name.trim();
    const trigger = toolForm.trigger.trim() || "/";
    if (!name) return;
    persistTools([
      { id: `t-${Date.now()}`, name, trigger, type: toolForm.type, assigned_agents: [] },
      ...tools,
    ]);
    setToolForm({ name: "", trigger: "", type: "script" });
    setToolDialogOpen(false);
    toast.success(`已导入「${name}」`);
  }

  return (
    <section className="flex flex-col h-full w-full text-sm">
      <header className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-8 flex-shrink-0">
        <div className="flex items-center gap-4">
          <h2 className="font-bold text-slate-800">扩展市场</h2>
          <div className="flex bg-slate-100 rounded-lg p-0.5">
            <button
              onClick={() => setTab("skill")}
              className={`ext-tab-btn px-4 py-1.5 rounded-md text-xs font-bold transition-all ${tab === "skill" ? "active" : ""}`}
            >
              Skill 指令集
            </button>
            <button
              onClick={() => setTab("tool")}
              className={`ext-tab-btn px-4 py-1.5 rounded-md text-xs font-bold transition-all ${tab === "tool" ? "active" : ""}`}
            >
              工具脚本
            </button>
          </div>
        </div>
        {tab === "skill" && (
          <button
            onClick={() => setSkillDialogOpen(true)}
            className="bg-amber-500 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-amber-600 transition-all flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> 安装新 Skill
          </button>
        )}
        {tab === "tool" && (
          <button
            onClick={() => setToolDialogOpen(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-blue-700 transition-all flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> 导入 Python 工具
          </button>
        )}
      </header>

      {/* Skill Tab */}
      {tab === "skill" && (
        <div className="flex-1 overflow-auto p-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {skills.map((skill) => (
              <div key={skill.id} className="interactive-card bg-white rounded-2xl p-5">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{skill.icon}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-slate-800">{skill.name}</h3>
                      {skill.installed && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-50 text-green-600">
                          已安装
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-1">{skill.description}</p>
                    {skill.assigned_agents.length > 0 && (
                      <div className="flex gap-1 mt-2">
                        {skill.assigned_agents.map((a) => (
                          <span key={a} className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600">
                            {a}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="mt-3 flex gap-2">
                      {!skill.installed ? (
                        <button
                          onClick={() => installSkill(skill.id)}
                          disabled={installing === skill.id}
                          className="text-[10px] font-bold px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-all"
                        >
                          {installing === skill.id ? "安装中..." : "安装"}
                        </button>
                      ) : (
                        <button
                          onClick={() => removeSkill(skill.id)}
                          className="text-[10px] font-bold px-3 py-1.5 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition-all"
                        >
                          卸载
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tool Tab */}
      {tab === "tool" && (
        <div className="flex-1 overflow-auto p-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {tools.map((tool) => (
              <div key={tool.id} className="interactive-card bg-white rounded-2xl p-5">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 flex-shrink-0">
                    <Wrench className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-bold text-slate-800">{tool.name}</h3>
                    <p className="text-[10px] text-slate-400 mt-1 font-mono">{tool.trigger}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        tool.type === "script" ? "bg-slate-100 text-slate-500" : "bg-amber-50 text-amber-600"
                      }`}>
                        {tool.type === "script" ? "脚本" : "动态"}
                      </span>
                      {tool.assigned_agents.map((a) => (
                        <span key={a} className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600">
                          {a}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Skill Dialog */}
      <Dialog open={skillDialogOpen} onOpenChange={setSkillDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>安装新 Skill</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="skill-name">名称</Label>
              <Input
                id="skill-name"
                value={skillForm.name}
                onChange={(e) => setSkillForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="如：跨语言检索"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="skill-desc">描述</Label>
              <Input
                id="skill-desc"
                value={skillForm.description}
                onChange={(e) => setSkillForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Skill 的功能说明"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="skill-icon">图标（Emoji）</Label>
              <Input
                id="skill-icon"
                value={skillForm.icon}
                onChange={(e) => setSkillForm((f) => ({ ...f, icon: e.target.value }))}
                maxLength={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSkillDialogOpen(false)}>取消</Button>
            <Button onClick={addSkill} disabled={!skillForm.name.trim()}>安装</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Tool Dialog */}
      <Dialog open={toolDialogOpen} onOpenChange={setToolDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>导入 Python 工具</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tool-name">名称</Label>
              <Input
                id="tool-name"
                value={toolForm.name}
                onChange={(e) => setToolForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="如：数据清洗脚本"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tool-trigger">触发命令</Label>
              <Input
                id="tool-trigger"
                value={toolForm.trigger}
                onChange={(e) => setToolForm((f) => ({ ...f, trigger: e.target.value }))}
                placeholder="/clean_data"
              />
            </div>
            <div className="space-y-2">
              <Label>类型</Label>
              <div className="flex bg-slate-100 rounded-lg p-0.5">
                <button
                  onClick={() => setToolForm((f) => ({ ...f, type: "script" }))}
                  className={`ext-tab-btn flex-1 px-4 py-1.5 rounded-md text-xs font-bold ${toolForm.type === "script" ? "active" : ""}`}
                >
                  脚本
                </button>
                <button
                  onClick={() => setToolForm((f) => ({ ...f, type: "dynamic" }))}
                  className={`ext-tab-btn flex-1 px-4 py-1.5 rounded-md text-xs font-bold ${toolForm.type === "dynamic" ? "active" : ""}`}
                >
                  动态
                </button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setToolDialogOpen(false)}>取消</Button>
            <Button onClick={addTool} disabled={!toolForm.name.trim()}>导入</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
