"use client";

import type { GraphNode } from "@/lib/api";

interface Props {
  nodes: GraphNode[];
}

export default function StatsPanel({ nodes }: Props) {
  const counts = nodes.reduce(
    (acc, node) => {
      acc[node.type] = (acc[node.type] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const stats = [
    { label: "Genes", count: counts.gene || 0, color: "text-blue-400", bg: "bg-blue-500/10" },
    { label: "Diseases", count: counts.disease || 0, color: "text-rose-400", bg: "bg-rose-500/10" },
    { label: "Trials", count: counts.trial || 0, color: "text-green-400", bg: "bg-green-500/10" },
    { label: "Drugs", count: counts.drug || 0, color: "text-amber-400", bg: "bg-amber-500/10" },
  ];

  return (
    <div className="grid grid-cols-4 gap-3">
      {stats.map((s) => (
        <div key={s.label} className={`rounded-xl border border-white/5 ${s.bg} px-4 py-3`}>
          <p className={`text-2xl font-bold ${s.color}`}>{s.count}</p>
          <p className="text-xs text-slate-500">{s.label}</p>
        </div>
      ))}
    </div>
  );
}
