"use client";

import { useState, useCallback } from "react";
import KnowledgeGraph from "@/components/KnowledgeGraph";
import ChatInterface from "@/components/ChatInterface";
import SearchBar from "@/components/SearchBar";
import StatsPanel from "@/components/StatsPanel";
import type { GraphNode, GraphEdge, KnowledgeGraphData } from "@/lib/api";
import { getKnowledgeGraph } from "@/lib/api";

export default function Home() {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);

  const handleSearch = useCallback(async (query: string) => {
    setIsLoading(true);
    try {
      const data = await getKnowledgeGraph(query);
      setNodes(data.nodes);
      setEdges(data.edges);
      setSelectedNode(null);
    } catch (err) {
      console.error("Search failed:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleGraphUpdate = useCallback((data: KnowledgeGraphData) => {
    setNodes(data.nodes);
    setEdges(data.edges);
    setSelectedNode(null);
  }, []);

  const handleNodeClick = useCallback((node: GraphNode) => {
    setSelectedNode(node);
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
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto flex min-h-0 w-full max-w-[1800px] flex-1 gap-0">
        {/* Graph Panel */}
        <div className="flex flex-1 flex-col border-r border-white/5">
          <div className="border-b border-white/5 px-6 py-3">
            <StatsPanel nodes={nodes} />
          </div>
          <div className="relative flex-1">
            <KnowledgeGraph nodes={nodes} edges={edges} onNodeClick={handleNodeClick} />
          </div>
        </div>

        {/* Side Panel */}
        <div className="flex w-[380px] flex-col">
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
                  backgroundColor:
                    selectedNode.type === "gene"
                      ? "rgba(59,130,246,0.2)"
                      : selectedNode.type === "disease"
                        ? "rgba(244,63,94,0.2)"
                        : selectedNode.type === "trial"
                          ? "rgba(34,197,94,0.2)"
                          : "rgba(245,158,11,0.2)",
                  color:
                    selectedNode.type === "gene"
                      ? "#60a5fa"
                      : selectedNode.type === "disease"
                        ? "#fb7185"
                        : selectedNode.type === "trial"
                          ? "#4ade80"
                          : "#fbbf24",
                }}
              >
                {selectedNode.type}
              </span>
              {selectedNode.data && (
                <pre className="mt-3 max-h-40 overflow-auto rounded-lg bg-black/30 p-3 text-xs text-slate-400">
                  {JSON.stringify(selectedNode.data, null, 2)}
                </pre>
              )}
            </div>
          )}

          {/* Chat */}
          <div className="min-h-0 flex-1">
            <ChatInterface onGraphUpdate={handleGraphUpdate} />
          </div>
        </div>
      </div>
    </div>
  );
}
