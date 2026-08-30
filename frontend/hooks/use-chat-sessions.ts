"use client";

import { useState, useCallback } from "react";
import { api, apiFetch } from "@/lib/api-client";
import type { ChatMessage } from "./use-chat-stream";

export interface ChatSessionInfo {
  id: string;
  title: string;
  parent_session_id: string | null;
  created_at: string;
}

export function useChatSessions() {
  const [sessions, setSessions] = useState<ChatSessionInfo[]>([]);
  const [loading, setLoading] = useState(false);

  const loadSessions = useCallback(async (projectId: string) => {
    setLoading(true);
    try {
      const data = await api.get<ChatSessionInfo[]>(`/sessions?project_id=${projectId}`);
      setSessions(data);
    } catch {
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const renameSession = useCallback(async (sessionId: string, title: string) => {
    await apiFetch(`/sessions/${sessionId}?title=${encodeURIComponent(title)}`, { method: "PATCH" });
    setSessions((prev) => prev.map((s) => (s.id === sessionId ? { ...s, title } : s)));
  }, []);

  const deleteSession = useCallback(async (sessionId: string) => {
    await api.delete(`/sessions/${sessionId}`);
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
  }, []);

  const fetchHistory = useCallback(async (sessionId: string): Promise<ChatMessage[]> => {
    const data = await api.get<
      { id: string; role: string; content: string; sources: { title: string; citation: string }[] }[]
    >(`/sessions/${sessionId}/messages`);
    return data
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role as ChatMessage["role"], content: m.content, sources: m.sources }));
  }, []);

  return { sessions, loading, loadSessions, renameSession, deleteSession, fetchHistory };
}
