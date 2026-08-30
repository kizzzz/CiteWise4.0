"use client";

import { useState, useCallback, useRef } from "react";
import { API_BASE, getAuthToken } from "@/lib/api-client";

export interface AgentEvent {
  agent: string;
  event: string;
  detail: string;
  timestamp?: number;
  duration_ms?: number;
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  sources?: { title: string; citation: string }[];
  agentEvents?: AgentEvent[];
  isStreaming?: boolean;
}

export function useChatStream() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [agentTimeline, setAgentTimeline] = useState<AgentEvent[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lastUserInputRef = useRef<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  // Bumped whenever the message list is replaced externally (session switch,
  // clear, history load). In-flight streams whose epoch is stale stop writing.
  const epochRef = useRef(0);

  const applySessionId = useCallback((id: string | null) => {
    sessionIdRef.current = id;
    setSessionId(id);
  }, []);

  const loadSession = useCallback(
    (id: string | null) => {
      epochRef.current += 1;
      abortRef.current?.abort();
      applySessionId(id);
    },
    [applySessionId]
  );

  const loadMessages = useCallback((msgs: ChatMessage[]) => {
    epochRef.current += 1;
    abortRef.current?.abort();
    setMessages(msgs);
    setAgentTimeline([]);
    const lastUser = [...msgs].reverse().find((m) => m.role === "user");
    lastUserInputRef.current = lastUser?.content ?? null;
  }, []);

  const runStream = useCallback(
    async (content: string, projectId: string) => {
      const myEpoch = ++epochRef.current;
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "", isStreaming: true, agentEvents: [] } as ChatMessage,
      ]);
      setIsStreaming(true);

      const token = await getAuthToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const controller = new AbortController();
      abortRef.current = controller;

      const guardedUpdate = (fn: (last: ChatMessage) => ChatMessage) => {
        setMessages((prev) => {
          if (epochRef.current !== myEpoch) return prev;
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last && last.role === "assistant") {
            updated[updated.length - 1] = fn(last);
          }
          return updated;
        });
      };

      try {
        const res = await fetch(`${API_BASE}/chat`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            message: content,
            project_id: projectId,
            session_id: sessionIdRef.current,
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ detail: `请求失败 (${res.status})` }));
          guardedUpdate((last) => ({
            ...last,
            content: err.detail || `请求失败 (${res.status})`,
            isStreaming: false,
          }));
          return;
        }
        if (!res.body) return;

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("event: ")) {
              continue;
            }
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));

                if (data.token) {
                  guardedUpdate((last) => ({ ...last, content: last.content + data.token }));
                } else if (data.content) {
                  guardedUpdate((last) => ({ ...last, content: data.content }));
                } else if (data.agent) {
                  setAgentTimeline((prev) => [...prev, data]);
                } else if (typeof data.session_id === "string") {
                  applySessionId(data.session_id);
                } else if (Array.isArray(data.sources)) {
                  guardedUpdate((last) => ({ ...last, sources: data.sources }));
                } else if (typeof data.message === "string" && data.message !== "完成") {
                  guardedUpdate((last) => ({ ...last, content: `服务异常：${data.message}`, isStreaming: false }));
                }
              } catch {
                // Ignore malformed SSE fragments
              }
            }
          }
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name !== "AbortError") {
          guardedUpdate((last) => ({ ...last, content: "请求失败，请检查网络后重试" }));
        }
      } finally {
        if (epochRef.current === myEpoch) {
          setIsStreaming(false);
          guardedUpdate((last) => ({ ...last, isStreaming: false }));
        }
      }
    },
    [applySessionId]
  );

  const sendMessage = useCallback(
    async (content: string, projectId: string) => {
      lastUserInputRef.current = content;
      epochRef.current += 1;
      abortRef.current?.abort();
      setMessages((prev) => [...prev, { role: "user", content } as ChatMessage]);
      await runStream(content, projectId);
    },
    [runStream]
  );

  const regenerate = useCallback(
    async (projectId: string) => {
      const content = lastUserInputRef.current;
      if (!content) return;
      setMessages((prev) => {
        const idx = prev.map((m) => m.role).lastIndexOf("user");
        return idx === -1 ? prev : prev.slice(0, idx + 1);
      });
      await runStream(content, projectId);
    },
    [runStream]
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const clear = useCallback(() => {
    epochRef.current += 1;
    abortRef.current?.abort();
    setMessages([]);
    setAgentTimeline([]);
    lastUserInputRef.current = null;
    applySessionId(null);
  }, [applySessionId]);

  return { messages, agentTimeline, isStreaming, sessionId, loadSession, loadMessages, sendMessage, regenerate, stop, clear };
}
