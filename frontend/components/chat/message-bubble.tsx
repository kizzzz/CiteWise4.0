"use client";

import { useState } from "react";
import { Copy, Check, RefreshCw, ThumbsUp, ThumbsDown } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { MarkdownContent } from "./markdown-content";

interface MessageBubbleProps {
  message: {
    role: string;
    content: string;
    isStreaming?: boolean;
    sources?: { title: string; citation: string }[];
  };
  onRegenerate?: () => void;
}

type Feedback = "up" | "down" | null;

export function MessageBubble({ message, onRegenerate }: MessageBubbleProps) {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const isUser = message.role === "user";
  const username = user?.user_metadata?.username || user?.email?.split("@")[0] || "U";
  const avatarLetter = username.charAt(0).toUpperCase();

  async function handleCopy() {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    toast.success("已复制到剪贴板");
    setTimeout(() => setCopied(false), 2000);
  }

  function handleFeedback(value: Exclude<Feedback, null>) {
    const next = feedback === value ? null : value;
    setFeedback(next);
    if (next) toast.success(next === "up" ? "感谢您的认可" : "已记录，我们会继续改进");
  }

  const showActions = !isUser && !message.isStreaming && message.content.length > 0;

  return (
    <div className={`group flex gap-4 mb-8 animate-fadeInUp ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-white shadow-xl flex-shrink-0">
          <svg viewBox="0 0 24 24" className="sparkle-icon" width="20" height="20" style={{ fill: "url(#geminiGradient)" }}>
            <path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z" />
          </svg>
        </div>
      )}
      <div className={`max-w-[80%] flex flex-col ${isUser ? "items-end" : "items-start"}`}>
        <div
          className={`bg-white border border-slate-200 p-6 rounded-3xl shadow-sm ${
            isUser
              ? "!bg-[#3b82f6] !text-white !border-transparent rounded-br-[4px]"
              : "text-slate-700 rounded-tl-none"
          }`}
        >
          {isUser ? (
            <p className="leading-relaxed text-sm whitespace-pre-wrap">{message.content}</p>
          ) : message.content.length === 0 && message.isStreaming ? (
            <span className="gemini-loading text-sm font-bold">思考中...</span>
          ) : (
            <MarkdownContent content={message.content} sources={message.sources} streaming={message.isStreaming} />
          )}
        </div>

        {showActions && (
          <div className="flex items-center gap-1 mt-2 ml-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <button
              onClick={handleCopy}
              className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all active:scale-90"
              title="复制全文"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
            {onRegenerate && (
              <button
                onClick={onRegenerate}
                className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all active:scale-90"
                title="重新生成"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={() => handleFeedback("up")}
              className={`p-1.5 rounded-lg transition-all active:scale-90 ${
                feedback === "up"
                  ? "text-green-500 bg-green-50"
                  : "text-slate-400 hover:text-green-600 hover:bg-green-50"
              }`}
              title="有帮助"
            >
              <ThumbsUp className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => handleFeedback("down")}
              className={`p-1.5 rounded-lg transition-all active:scale-90 ${
                feedback === "down"
                  ? "text-red-500 bg-red-50"
                  : "text-slate-400 hover:text-red-600 hover:bg-red-50"
              }`}
              title="需改进"
            >
              <ThumbsDown className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
      {isUser && (
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-blue-400 flex items-center justify-center text-white font-bold text-sm shadow-xl flex-shrink-0">
          {avatarLetter}
        </div>
      )}
    </div>
  );
}
