"use client";

import { useState, useCallback, useEffect } from "react";
import KnowledgeGraph from "@/components/KnowledgeGraph";
import ChatInterface from "@/components/ChatInterface";
import SearchBar from "@/components/SearchBar";
import StatsPanel from "@/components/StatsPanel";
import TopicPanel from "@/components/TopicPanel";
import type { GraphNode, GraphEdge, KnowledgeGraphData, TopicCluster, LinkItem } from "@/lib/api";
import { getKnowledgeGraph } from "@/lib/api";
import { filterGraphByTypes, normalizeTopics } from "@/lib/graph";

const NODE_TYPES: GraphNode["type"][] = ["gene", "disease", "trial", "drug", "paper"];
const NODE_BADGES: Record<GraphNode["type"], { bg: string; color: string }> = {
  gene: { bg: "rgba(59,130,246,0.2)", color: "#60a5fa" },
  disease: { bg: "rgba(244,63,94,0.2)", color: "#fb7185" },
  trial: { bg: "rgba(34,197,94,0.2)", color: "#4ade80" },
  drug: { bg: "rgba(245,158,11,0.2)", color: "#fbbf24" },
  paper: { bg: "rgba(167,139,250,0.2)", color: "#c4b5fd" },
};

export default function Home() {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [topics, setTopics] = useState<TopicCluster[]>([]);
  const [links, setLinks] = useState<LinkItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [recentQueries, setRecentQueries] = useState<string[]>([]);
  const [enabledTypes, setEnabledTypes] = useState<Set<GraphNode["type"]>>(
    () => new Set(NODE_TYPES)
  );

  useEffect(() => {
    const stored = window.localStorage.getItem("biolens_recent_queries");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setRecentQueries(parsed.filter((q) => typeof q === "string").slice(0, 8));
        }
      } catch {
        setRecentQueries([]);
      }
    }
  }, []);

  const updateRecentQueries = useCallback((query: string) => {
    setRecentQueries((prev) => {
      const next = [query, ...prev.filter((item) => item !== query)].slice(0, 8);
      window.localStorage.setItem("biolens_recent_queries", JSON.stringify(next));
      return next;
    });
  }, []);

  const handleSearch = useCallback(async (query: string) => {
    setIsLoading(true);
    try {
      const data = await getKnowledgeGraph(query);
      setNodes(data.nodes);
      setEdges(data.edges);
      setTopics(normalizeTopics(data.topics));
      setLinks(data.links || []);
      setSelectedNode(null);
      setEnabledTypes(new Set(NODE_TYPES));
      updateRecentQueries(query);
    } catch (err) {
      console.error("Search failed:", err);
    } finally {
      setIsLoading(false);
    }
  }, [updateRecentQueries]);

  const handleGraphUpdate = useCallback((data: KnowledgeGraphData) => {
    setNodes(data.nodes);
    setEdges(data.edges);
    setTopics(normalizeTopics(data.topics));
    setLinks(data.links || []);
    setSelectedNode(null);
    setEnabledTypes(new Set(NODE_TYPES));
    if (data.query) {
      updateRecentQueries(data.query);
    }
  }, [updateRecentQueries]);

  const handleNodeClick = useCallback((node: GraphNode) => {
    setSelectedNode(node);
  }, []);

  const { nodes: filteredNodes, edges: filteredEdges } = filterGraphByTypes(
    nodes,
    edges,
    enabledTypes
  );

  const toggleType = useCallback((type: GraphNode["type"]) => {
    setEnabledTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  }, []);

  return (
    <div className="flex h-screen flex-col">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/20 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1800px] items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-emerald-500">
              <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white">BioLens</h1>
              <p className="text-xs text-slate-500">Biomedical Knowledge Explorer</p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              API Connected
            </span>
          </div>
        </div>
      </header>

      {/* Search Section */}
      <div className="border-b border-white/5 bg-black/10 px-6 py-4">
        <div className="mx-auto max-w-[1800px]">
          <SearchBar onSearch={handleSearch} isLoading={isLoading} />
          {recentQueries.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-500">Recent:</span>
              {recentQueries.map((query) => (
                <button
                  key={query}
                  onClick={() => handleSearch(query)}
                  className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300 transition hover:border-blue-500/40 hover:bg-blue-500/10"
                >
                  {query}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto flex min-h-0 w-full max-w-[1800px] flex-1 gap-0">
        {/* Graph Panel */}
        <div className="flex flex-1 flex-col border-r border-white/5">
          <div className="border-b border-white/5 px-6 py-3">
            <StatsPanel nodes={filteredNodes} />
            <div className="mt-3 flex flex-wrap gap-2">
              {NODE_TYPES.map((type) => (
                <button
                  key={type}
                  onClick={() => toggleType(type)}
                  className={`rounded-full border px-2.5 py-1 text-xs capitalize transition ${
                    enabledTypes.has(type)
                      ? "border-blue-500/50 bg-blue-500/15 text-blue-300"
                      : "border-white/10 bg-transparent text-slate-500 hover:text-slate-300"
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>
          <div className="relative flex-1">
            <KnowledgeGraph nodes={filteredNodes} edges={filteredEdges} onNodeClick={handleNodeClick} />
          </div>
        </div>

        {/* Side Panel */}
        <div className="flex w-[380px] min-h-0 flex-col">
          <div className="max-h-[48%] min-h-0 overflow-y-auto">
            {/* Node Detail */}
            {selectedNode && (
              <div className="border-b border-white/10 p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-200">{selectedNode.label}</h3>
                  <button onClick={() => setSelectedNode(null)} className="text-slate-500 hover:text-slate-300">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <span
                  className="mt-1 inline-block rounded-full px-2 py-0.5 text-xs capitalize"
                  style={{
                    backgroundColor: NODE_BADGES[selectedNode.type].bg,
                    color: NODE_BADGES[selectedNode.type].color,
                  }}
                >
                  {selectedNode.type}
                </span>
                {selectedNode.data && (
                  <pre className="mt-3 max-h-40 overflow-auto rounded-lg bg-black/30 p-3 text-xs text-slate-400">
                    {JSON.stringify(selectedNode.data, null, 2)}
                  </pre>
                )}
                {selectedNode.url && (
                  <a
                    href={selectedNode.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex text-xs text-blue-300 transition hover:text-blue-200"
                  >
                    Open source record
                  </a>
                )}
              </div>
            )}

            <TopicPanel topics={topics} links={links} />
          </div>

          {/* Chat */}
          <div className="min-h-[340px] flex-1 border-t border-white/10">
            <ChatInterface onGraphUpdate={handleGraphUpdate} />
          </div>
        </div>
      </div>
    </div>
  );
}
