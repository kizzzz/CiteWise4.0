"use client";

import { useState, useEffect, useCallback } from "react";
import {
  FileText,
  UploadCloud,
  Trash2,
  StickyNote,
  Sparkles,
  GitMerge,
} from "lucide-react";
import { useProject } from "@/hooks/use-project";
import { api } from "@/lib/api-client";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";

interface Paper {
  id: string;
  title: string | null;
  authors: string | null;
  year: number | null;
  filename: string | null;
  chunk_count: number;
  indexed_at: string;
}

export default function PapersPage() {
  const { activeProject } = useProject();
  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ name: "", percent: 0 });
  const [tab, setTab] = useState<"list" | "notes">("list");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useState<HTMLInputElement | null>(null);

  const loadPapers = useCallback(async () => {
    if (!activeProject) return;
    try {
      const data = await api.get<Paper[]>(`/papers/?project_id=${activeProject.id}`);
      setPapers(data);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? `文献加载失败：${err.message}` : "文献加载失败，请刷新重试");
    } finally { setLoading(false); }
  }, [activeProject]);

  useEffect(() => { loadPapers(); }, [loadPapers]);

  async function handleUpload(files: FileList) {
    if (!activeProject) return;
    setUploading(true);
    const file = files[0];
    setUploadProgress({ name: file?.name || "解析中...", percent: 0 });

    const formData = new FormData();
    formData.append("project_id", activeProject.id);
    for (let i = 0; i < files.length; i++) {
      formData.append("files", files[i]);
    }

    // Simulate progress
    const interval = setInterval(() => {
      setUploadProgress((prev) => ({ ...prev, percent: Math.min(prev.percent + 10, 90) }));
    }, 200);

    try {
      await api.post<{ message: string }>("/papers/upload", formData);
      clearInterval(interval);
      setUploadProgress((prev) => ({ ...prev, percent: 100 }));
      toast.success("文献上传成功");
      await loadPapers();
    } catch (err: unknown) {
      clearInterval(interval);
      toast.error(err instanceof Error ? `上传失败：${err.message}` : "上传失败，请重试");
    } finally {
      setTimeout(() => {
        setUploading(false);
        setUploadProgress({ name: "", percent: 0 });
      }, 500);
    }
  }

  async function handleDelete(paperId: string) {
    try {
      await api.delete(`/papers/${paperId}`);
      setPapers((prev) => prev.filter((p) => p.id !== paperId));
      toast.success("已删除");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? `删除失败：${err.message}` : "删除失败，请重试");
    }
  }

  return (
    <section className="flex flex-col h-full w-full">
      {/* Header */}
      <header className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-8 flex-shrink-0">
        <div className="flex items-center gap-4">
          <h2 className="font-bold text-slate-800">文献管理</h2>
          <div className="flex bg-slate-100 rounded-lg p-0.5">
            <button
              onClick={() => setTab("list")}
              className={`ext-tab-btn px-4 py-1.5 rounded-md text-xs font-bold transition-all ${tab === "list" ? "active" : ""}`}
            >
              文献列表
            </button>
            <button
              onClick={() => setTab("notes")}
              className={`ext-tab-btn px-4 py-1.5 rounded-md text-xs font-bold transition-all ${tab === "notes" ? "active" : ""}`}
            >
              随手记
            </button>
          </div>
        </div>
        <label className="bg-blue-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-blue-700 transition-all flex items-center gap-2 cursor-pointer">
          <UploadCloud className="w-4 h-4" /> 上传文献
          <input
            type="file"
            accept=".pdf,.doc,.docx,.md,.txt,.xlsx,.xls"
            multiple
            className="hidden"
            onChange={(e) => e.target.files && handleUpload(e.target.files)}
          />
        </label>
      </header>

      {/* Upload Progress */}
      {uploading && (
        <div className="px-8 py-4 bg-white border-b border-blue-100 flex-shrink-0 animate-fadeInDown">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <FileText className="w-4 h-4" />
            </div>
            <div className="flex-1 text-[10px] font-bold text-slate-700">
              <div className="flex justify-between mb-1">
                <span>{uploadProgress.name}</span>
                <span className="text-blue-600">{uploadProgress.percent}%</span>
              </div>
              <div className="w-full bg-slate-100 h-1 rounded-full overflow-hidden">
                <div className="bg-blue-600 h-full transition-all duration-200" style={{ width: `${uploadProgress.percent}%` }} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Paper List Tab */}
      {tab === "list" && (
        <div className="flex-1 overflow-auto p-8">
          {/* Drag & Drop Zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); e.dataTransfer.files.length > 0 && handleUpload(e.dataTransfer.files); }}
            className={`mb-8 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-10 transition-all ${
              dragOver ? "border-blue-500 bg-blue-50/50" : "border-slate-200"
            }`}
          >
            <UploadCloud className={`w-10 h-10 mb-3 ${dragOver ? "text-blue-500" : "text-slate-300"}`} />
            <p className="text-sm text-slate-500 font-medium">拖拽文件到此处上传</p>
            <p className="text-xs text-slate-400 mt-1">支持 PDF, DOC, DOCX, MD, TXT, XLSX, XLS</p>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="interactive-card bg-white rounded-2xl p-5 flex items-start gap-4">
                  <Skeleton className="w-10 h-10 rounded-xl flex-shrink-0" />
                  <div className="flex-1 space-y-2.5">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : papers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <FileText className="w-12 h-12 mb-4 text-slate-300" />
              <p className="text-sm">暂无论文，上传 PDF 开始使用</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {papers.map((paper) => (
                <Link key={paper.id} href={`/papers/${paper.id}`}>
                  <div className="interactive-card bg-white rounded-2xl p-5 cursor-pointer group">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 flex-shrink-0">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-bold text-slate-800 truncate group-hover:text-blue-600 transition-colors">
                          {paper.title || paper.filename || "未命名"}
                        </h3>
                        <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-400">
                          {paper.year && <span>{paper.year}</span>}
                          {paper.authors && (
                            <span className="truncate max-w-[150px]">{paper.authors}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-[10px] font-semibold text-slate-300 bg-slate-50 px-2 py-0.5 rounded-full">
                            {paper.chunk_count} 片段
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDelete(paper.id); }}
                        className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-300 hover:text-red-500 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Notes Tab */}
      {tab === "notes" && (
        <div className="flex-1 overflow-auto p-8 space-y-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400 font-bold">0 条笔记</span>
            </div>
            <div className="flex items-center gap-2">
              <button className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-600 rounded-lg text-xs font-bold hover:bg-amber-100 transition-all">
                <Sparkles className="w-3.5 h-3.5" /> AI 分类
              </button>
              <button className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 text-purple-600 rounded-lg text-xs font-bold hover:bg-purple-100 transition-all">
                <GitMerge className="w-3.5 h-3.5" /> 一键整理
              </button>
            </div>
          </div>
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <StickyNote className="w-12 h-12 mb-4 text-slate-300" />
            <p className="text-sm">暂无笔记，点击右下角按钮或按 Shift+N 添加</p>
          </div>
        </div>
      )}
    </section>
  );
}
