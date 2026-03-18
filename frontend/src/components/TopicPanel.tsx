"use client";

import type { LinkItem, TopicCluster } from "@/lib/api";

interface Props {
  topics: TopicCluster[];
  links: LinkItem[];
}

export default function TopicPanel({ topics, links }: Props) {
  return (
    <div className="border-b border-white/10 p-4">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-slate-200">Topic Clusters</h3>
        <p className="text-xs text-slate-500">High-level categories extracted from current query evidence.</p>
      </div>

      {topics.length === 0 ? (
        <p className="text-xs text-slate-500">Search to generate cluster summaries.</p>
      ) : (
        <div className="space-y-2">
          {topics.map((topic) => (
            <div key={topic.id} className="rounded-lg border border-white/10 bg-white/5 p-2.5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-slate-200">{topic.label}</p>
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-slate-300">{topic.count}</span>
              </div>
              <p className="mt-1 line-clamp-2 text-[11px] text-slate-400">
                {topic.highlights.length > 0 ? topic.highlights.join(" • ") : "No highlights available."}
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Sources</h4>
        <div className="mt-2 max-h-36 space-y-1 overflow-auto pr-1">
          {links.length === 0 && <p className="text-xs text-slate-500">No source links yet.</p>}
          {links.slice(0, 10).map((item, idx) => (
            <a
              key={`${item.url}-${idx}`}
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="block rounded-md border border-white/5 px-2 py-1.5 text-xs text-slate-300 transition hover:border-blue-500/40 hover:bg-blue-500/10"
            >
              <span className="mr-2 text-[10px] uppercase tracking-wide text-slate-500">{item.type}</span>
              {item.label}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
