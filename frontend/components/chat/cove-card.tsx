"use client";

interface CoveCardProps {
  score: number;
  flaggedItems: string[];
}

export function CoveCard({ score, flaggedItems }: CoveCardProps) {
  const level = score >= 80 ? "high" : score >= 50 ? "medium" : "low";

  return (
    <div className="cove-card">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">CoVe 验证</span>
        <span className={`cove-score ${level}`}>{score}%</span>
      </div>
      <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mb-3">
        <div
          className={`h-full rounded-full transition-all ${
            level === "high" ? "bg-green-500" : level === "medium" ? "bg-amber-500" : "bg-red-500"
          }`}
          style={{ width: `${score}%` }}
        />
      </div>
      {flaggedItems.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] font-bold text-slate-400 uppercase">标记项</p>
          {flaggedItems.map((item, i) => (
            <div key={i} className="cove-flagged-item">
              <p className="text-xs text-slate-600">{item}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
