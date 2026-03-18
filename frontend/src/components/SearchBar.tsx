"use client";

import { useState } from "react";

interface Props {
  onSearch: (query: string) => void;
  isLoading?: boolean;
}

const SUGGESTIONS = [
  { label: "BRCA1", type: "gene" },
  { label: "TP53", type: "gene" },
  { label: "EGFR", type: "gene" },
  { label: "Lung Cancer", type: "disease" },
  { label: "Alzheimer's", type: "disease" },
  { label: "Imatinib", type: "drug" },
];

const TYPE_COLORS: Record<string, string> = {
  gene: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  disease: "bg-rose-500/20 text-rose-400 border-rose-500/30",
  drug: "bg-amber-500/20 text-amber-400 border-amber-500/30",
};

export default function SearchBar({ onSearch, isLoading }: Props) {
  const [query, setQuery] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query.trim());
    }
  };

  return (
    <div>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <svg
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search genes, diseases, drugs, or clinical trials..."
            className="w-full rounded-lg border border-white/10 bg-white/5 py-2.5 pl-10 pr-4 text-sm text-slate-200 placeholder-slate-500 outline-none transition focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30"
            disabled={isLoading}
          />
        </div>
        <button
          type="submit"
          disabled={isLoading || !query.trim()}
          className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-blue-500 disabled:opacity-40"
        >
          {isLoading ? "Searching..." : "Explore"}
        </button>
      </form>

      <div className="mt-3 flex flex-wrap gap-2">
        <span className="text-xs text-slate-500">Try:</span>
        {SUGGESTIONS.map((s) => (
          <button
            key={s.label}
            disabled={isLoading}
            onClick={() => {
              setQuery(s.label);
              onSearch(s.label);
            }}
            className={`rounded-full border px-3 py-1 text-xs transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40 ${TYPE_COLORS[s.type]}`}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}
