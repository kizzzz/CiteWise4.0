"use client";

import { useState, useEffect, useCallback, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeHighlight from "rehype-highlight";
import rehypeKatex from "rehype-katex";
import { Copy, Check, BookOpen, Globe, Brain, FileText } from "lucide-react";
import { rehypeSourceAnnotations } from "@/lib/rehype-source-annotations";

export interface MarkdownSource {
  title: string;
  citation: string;
}

interface AnnotationPopover {
  x: number;
  y: number;
  kind: "kb" | "web" | "ai" | "cite";
  citeIndex?: number;
}

const ANNOTATION_LEGEND: Record<"kb" | "web" | "ai", { label: string; desc: string; icon: typeof BookOpen; color: string }> = {
  kb: { label: "知识库来源", desc: "该内容基于您项目文献库中的资料生成", icon: BookOpen, color: "text-blue-600" },
  web: { label: "联网搜索来源", desc: "该内容基于实时联网搜索结果生成", icon: Globe, color: "text-green-600" },
  ai: { label: "模型推理", desc: "该内容由大模型基于上下文推理生成，未引用外部资料", icon: Brain, color: "text-purple-600" },
};

function CodeBlock({ children }: { children?: ReactNode }) {
  const [copied, setCopied] = useState(false);

  const child = Array.isArray(children) ? children[0] : children;
  const className: string = (child as { props?: { className?: string } })?.props?.className || "";
  const lang = className.replace("language-", "").toUpperCase() || "CODE";

  const handleCopy = useCallback(async (e: React.MouseEvent<HTMLButtonElement>) => {
    const pre = (e.currentTarget.closest(".md-codeblock") as HTMLElement)?.querySelector("pre");
    const text = pre?.textContent ?? "";
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  return (
    <div className="md-codeblock rounded-xl overflow-hidden my-3 border border-slate-700/60 shadow-sm">
      <div className="flex items-center justify-between bg-slate-800 px-4 py-2">
        <span className="text-[10px] font-bold tracking-widest text-slate-400">{lang}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 hover:text-white transition-colors"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? "已复制" : "复制"}
        </button>
      </div>
      {children}
    </div>
  );
}

function PopoverContent({ popover, sources }: { popover: AnnotationPopover; sources?: MarkdownSource[] }) {
  if (popover.kind === "cite") {
    const source = sources?.[popover.citeIndex ?? -1];
    return (
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-blue-600">
          <FileText className="w-3.5 h-3.5" /> 引用来源 {popover.kind === "cite" ? `#${(popover.citeIndex ?? 0) + 1}` : ""}
        </div>
        {source ? (
          <>
            <div className="text-xs font-semibold text-slate-800 leading-snug">{source.title}</div>
            <div className="text-[11px] text-slate-500 leading-snug max-w-[240px]">{source.citation}</div>
          </>
        ) : (
          <div className="text-xs text-slate-500">该引用暂无对应来源详情</div>
        )}
      </div>
    );
  }
  const legend = ANNOTATION_LEGEND[popover.kind];
  const Icon = legend.icon;
  return (
    <div className="space-y-1.5">
      <div className={`flex items-center gap-1.5 text-[11px] font-bold ${legend.color}`}>
        <Icon className="w-3.5 h-3.5" /> {legend.label}
      </div>
      <div className="text-xs text-slate-600 leading-snug max-w-[240px]">{legend.desc}</div>
    </div>
  );
}

interface MarkdownContentProps {
  content: string;
  sources?: MarkdownSource[];
  streaming?: boolean;
}

export function MarkdownContent({ content, sources, streaming }: MarkdownContentProps) {
  const [popover, setPopover] = useState<AnnotationPopover | null>(null);

  const closePopover = useCallback(() => setPopover(null), []);

  useEffect(() => {
    if (!popover) return;
    const onMouseDown = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest(".annotation-popover")) closePopover();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePopover();
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [popover, closePopover]);

  function handleAnnotationClick(e: React.MouseEvent<HTMLDivElement>) {
    const target = (e.target as HTMLElement).closest<HTMLElement>("[data-annotation-type],[data-cite-index]");
    if (!target) return;
    const rect = target.getBoundingClientRect();
    const kind = target.dataset.annotationType as AnnotationPopover["kind"] | undefined;
    const citeIndex = target.dataset.citeIndex;
    setPopover({
      x: Math.min(rect.left, window.innerWidth - 280),
      y: rect.bottom + 8,
      kind: kind ?? "cite",
      citeIndex: citeIndex !== undefined ? parseInt(citeIndex, 10) : undefined,
    });
  }

  return (
    <div onClick={handleAnnotationClick}>
      <div className={`md-render ${streaming ? "streaming" : ""}`}>
        <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeSourceAnnotations, rehypeHighlight, rehypeKatex]}
        components={{
          pre: CodeBlock,
          code: ({ className, children, ...props }) => {
            const isBlock = /language-/.test(className || "");
            return (
              <code className={isBlock ? `${className} hljs` : undefined} {...props}>
                {children}
              </code>
            );
          },
          table: ({ children }) => (
            <div className="overflow-x-auto my-2 rounded-lg border border-slate-200">
              <table className="academic-table">{children}</table>
            </div>
          ),
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
        }}
        >
          {content}
        </ReactMarkdown>
      </div>

      {popover && (
        <div
          className="annotation-popover fixed z-50 bg-white border border-slate-200 rounded-xl shadow-xl px-4 py-3 animate-fadeIn"
          style={{ left: popover.x, top: popover.y }}
        >
          <PopoverContent popover={popover} sources={sources} />
        </div>
      )}
    </div>
  );
}
