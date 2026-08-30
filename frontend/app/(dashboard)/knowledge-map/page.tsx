"use client";

import { useState, useEffect, useCallback } from "react";
import { Share2 } from "lucide-react";
import { useProject } from "@/hooks/use-project";
import { api } from "@/lib/api-client";
import { ForceGraph } from "@/components/knowledge-map/force-graph";

interface MapNode {
  id: string;
  label: string;
  authors: string | null;
  year: number | null;
  chunks: number;
}

interface MapEdge {
  source: string;
  target: string;
  weight: number;
  shared_topics: string[];
}

export default function KnowledgeMapPage() {
  const { activeProject } = useProject();
  const [nodes, setNodes] = useState<MapNode[]>([]);
  const [edges, setEdges] = useState<MapEdge[]>([]);
  const [loading, setLoading] = useState(true);

  const loadMap = useCallback(async () => {
    if (!activeProject) return;
    try {
      const data = await api.get<{ nodes: MapNode[]; edges: MapEdge[] }>(`/knowledge/map?project_id=${activeProject.id}`);
      setNodes(data.nodes || []);
      setEdges(data.edges || []);
    } catch { /* */ } finally { setLoading(false); }
  }, [activeProject]);

  useEffect(() => { loadMap(); }, [loadMap]);

  return (
    <section className="flex flex-col h-full w-full">
      <header className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-8 flex-shrink-0">
        <div className="flex items-center gap-4">
          <h2 className="font-bold text-slate-800">知识地图</h2>
          <span className="text-xs text-slate-400 font-medium">
            {nodes.length} 篇文献, {edges.length} 条关联
          </span>
        </div>
        {/* Legend */}
        <div className="flex items-center gap-4 text-[10px] font-bold text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="w-6 h-0.5 bg-blue-500 inline-block" /> 语义相似
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-6 h-0.5 bg-amber-400 inline-block" style={{ borderTop: "2px dashed #f59e0b", height: 0 }} /> 引用关联
          </span>
        </div>
      </header>

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-slate-400">
          加载中...
        </div>
      ) : nodes.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center text-slate-400">
            <Share2 className="w-12 h-12 mb-4 text-slate-300" />
            <p className="text-sm">上传论文后，知识地图将展示文献关联</p>
          </div>
        </div>
      ) : (
        <div className="flex-1">
          <ForceGraph nodes={nodes} edges={edges} />
        </div>
      )}
    </section>
  );
}
