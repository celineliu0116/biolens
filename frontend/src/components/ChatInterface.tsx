"use client";

import { useState, useRef, useEffect } from "react";
import type { ChatMessage, KnowledgeGraphData } from "@/lib/api";

interface Props {
  onGraphUpdate?: (data: KnowledgeGraphData) => void;
}

export default function ChatInterface({ onGraphUpdate }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        'Welcome to BioLens! I can help you explore biomedical data. Try asking about a gene like "Tell me about BRCA1" or a disease like "Show clinical trials for lung cancer".',
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg: ChatMessage = { role: "user", content: input };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const graphResp = await fetch(
        `${API_BASE}/api/knowledge-graph?q=${encodeURIComponent(input)}`
      );

      if (graphResp.ok) {
        const graphData: KnowledgeGraphData = await graphResp.json();
        const nodeCount = graphData.nodes.length;
        const edgeCount = graphData.edges.length;

        const types = new Set(graphData.nodes.map((n) => n.type));
        const typeSummary = Array.from(types).join(", ");

        const assistantMsg: ChatMessage = {
          role: "assistant",
          content: `I found ${nodeCount} entities and ${edgeCount} connections related to "${input}". The graph includes ${typeSummary} nodes. Click on any node in the visualization to explore further.`,
          graphData,
        };

        setMessages((prev) => [...prev, assistantMsg]);
        if (onGraphUpdate) onGraphUpdate(graphData);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "I had trouble fetching that data. Please check the backend is running and try again.",
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Could not connect to the server. Make sure the backend is running on port 8000.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-white/10 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-200">Research Assistant</h2>
        <p className="text-xs text-slate-500">Powered by MCP + LLM</p>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-xl px-4 py-2.5 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-blue-600/80 text-white"
                  : "border border-white/10 bg-white/5 text-slate-300"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
              <div className="flex gap-1">
                <span className="h-2 w-2 animate-bounce rounded-full bg-blue-400" style={{ animationDelay: "0ms" }} />
                <span className="h-2 w-2 animate-bounce rounded-full bg-blue-400" style={{ animationDelay: "150ms" }} />
                <span className="h-2 w-2 animate-bounce rounded-full bg-blue-400" style={{ animationDelay: "300ms" }} />
              </div>
              <span className="text-xs text-slate-500">Searching biomedical databases...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="border-t border-white/10 p-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about genes, diseases, or drugs..."
            className="flex-1 rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-slate-200 placeholder-slate-500 outline-none transition focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-500 disabled:opacity-40 disabled:hover:bg-blue-600"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </form>
    </div>
  );
}
