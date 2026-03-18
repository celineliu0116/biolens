const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");

export interface GraphNode {
  id: string;
  type: "gene" | "disease" | "trial" | "drug" | "paper";
  label: string;
  data?: Record<string, unknown>;
  url?: string;
}

export interface GraphEdge {
  source: string;
  target: string;
  type: string;
  score?: number;
}

export interface KnowledgeGraphData {
  query?: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  topics?: TopicCluster[];
  links?: LinkItem[];
  meta?: Record<string, unknown>;
}

export interface TopicCluster {
  id: string;
  label: string;
  count: number;
  highlights: string[];
}

export interface LinkItem {
  label: string;
  url: string;
  type: string;
}

export interface SearchResults {
  query: string;
  pubmed: Array<Record<string, unknown>>;
  clinical_trials: Array<Record<string, unknown>>;
  openfda: Array<Record<string, unknown>>;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  graphData?: KnowledgeGraphData;
  citations?: LinkItem[];
}

function buildFetchUrl(path: string, params?: Record<string, string>) {
  const hasAbsoluteBase = Boolean(API_BASE);
  const url = new URL(hasAbsoluteBase ? `${API_BASE}${path}` : path, "http://biolens.local");
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  return hasAbsoluteBase ? url.toString() : `${path}${url.search}`;
}

async function fetchJSON<T>(
  path: string,
  params?: Record<string, string>,
  options?: RequestInit
): Promise<T> {
  const resp = await fetch(buildFetchUrl(path, params), options);
  if (!resp.ok) {
    throw new Error(`API error: ${resp.status} ${resp.statusText}`);
  }
  return resp.json();
}

export async function search(query: string): Promise<SearchResults> {
  return fetchJSON<SearchResults>("/api/search", { q: query });
}

export async function getKnowledgeGraph(query: string): Promise<KnowledgeGraphData> {
  return fetchJSON<KnowledgeGraphData>("/api/knowledge-graph", { q: query });
}

export async function chat(
  message: string,
  history: Array<Pick<ChatMessage, "role" | "content">>
): Promise<{ reply: string; graph_data: KnowledgeGraphData; citations: LinkItem[] }> {
  return fetchJSON<{ reply: string; graph_data: KnowledgeGraphData; citations: LinkItem[] }>(
    "/api/chat",
    undefined,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, history }),
    }
  );
}

export async function getGeneInfo(symbol: string) {
  return fetchJSON<Record<string, unknown>>(`/api/genes/${symbol}`);
}

export async function getDiseaseTrials(disease: string) {
  return fetchJSON<Record<string, unknown>>(`/api/diseases/${disease}/trials`);
}

export async function getDrugAdverseEvents(drug: string) {
  return fetchJSON<Record<string, unknown>>(`/api/drugs/${drug}/adverse-events`);
}
