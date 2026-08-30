"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { StickyNote, X, Sparkles, Pin, Trash2 } from "lucide-react";

interface QuickNote {
  id: string;
  content: string;
  url?: string;
  type: string;
  pinned: boolean;
  created_at: string;
}

const noteTypes = [
  { id: "idea", label: "想法", color: "bg-blue-500" },
  { id: "reference", label: "参考", color: "bg-green-500" },
  { id: "todo", label: "待办", color: "bg-amber-500" },
  { id: "quote", label: "引用", color: "bg-purple-500" },
];

export function NoteFab() {
  const pathname = usePathname();
  const showFab = pathname === "/papers" || pathname?.startsWith("/papers/");
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState<QuickNote[]>([]);
  const [content, setContent] = useState("");
  const [url, setUrl] = useState("");
  const [type, setType] = useState("idea");

  // Shift+N shortcut
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.shiftKey && e.key === "N") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  function saveNote() {
    if (!content.trim()) return;
    const note: QuickNote = {
      id: Date.now().toString(),
      content: content.trim(),
      url: url.trim() || undefined,
      type,
      pinned: false,
      created_at: new Date().toISOString(),
    };
    setNotes((prev) => [note, ...prev]);
    setContent("");
    setUrl("");
  }

  function deleteNote(id: string) {
    setNotes((prev) => prev.filter((n) => n.id !== id));
  }

  function togglePin(id: string) {
    setNotes((prev) => prev.map((n) => n.id === id ? { ...n, pinned: !n.pinned } : n));
  }

  const typeInfo = noteTypes.find((t) => t.id === type) || noteTypes[0];

  if (!showFab) return null;

  return (
    <>
      {/* FAB Button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-8 right-8 z-50 w-14 h-14 bg-indigo-600 text-white rounded-full shadow-lg hover:bg-indigo-700 transition-all active:scale-95 flex items-center justify-center"
        title="随手记 (Shift+N)"
      >
        <StickyNote className="w-6 h-6" />
      </button>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 modal-overlay flex items-end justify-end p-6" onClick={() => setOpen(false)}>
          <div
            className="bg-white rounded-2xl shadow-2xl w-96 max-h-[70vh] flex flex-col animate-fadeInUp"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 text-sm">随手记</h3>
              <button onClick={() => setOpen(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Note input */}
            <div className="p-5 space-y-3 border-b border-slate-100">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="记录灵感、想法或待办..."
                rows={3}
                className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
              />
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="关联 URL（可选）"
                className="w-full border border-slate-200 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <div className="flex items-center justify-between">
                {/* Type selector */}
                <div className="flex gap-1.5">
                  {noteTypes.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setType(t.id)}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold transition-all ${
                        type === t.id
                          ? `${t.color} text-white`
                          : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${type === t.id ? "bg-white" : t.color}`} />
                      {t.label}
                    </button>
                  ))}
                </div>
                <button
                  onClick={saveNote}
                  disabled={!content.trim()}
                  className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 disabled:opacity-50 transition-all"
                >
                  保存
                </button>
              </div>
            </div>

            {/* Notes list */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2 max-h-[40vh]">
              {notes.length === 0 ? (
                <p className="text-center text-slate-400 text-xs py-4">暂无笔记</p>
              ) : (
                notes.map((note) => {
                  const nt = noteTypes.find((t) => t.id === note.type) || noteTypes[0];
                  return (
                    <div key={note.id} className={`p-3 rounded-xl border-l-4 ${nt.color} bg-slate-50`}>
                      <div className="flex items-start gap-2">
                        <p className="text-xs text-slate-700 flex-1">{note.content}</p>
                        <div className="flex items-center gap-1">
                          <button onClick={() => togglePin(note.id)} className={`p-1 ${note.pinned ? "text-blue-600" : "text-slate-300"} hover:text-blue-600 transition-all`}>
                            <Pin className="w-3 h-3" />
                          </button>
                          <button onClick={() => deleteNote(note.id)} className="p-1 text-slate-300 hover:text-red-500 transition-all">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      {note.url && (
                        <p className="text-[10px] text-blue-500 mt-1 truncate">{note.url}</p>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
