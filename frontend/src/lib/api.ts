const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface GraphNode {
  id: string;
  type: "gene" | "disease" | "trial" | "drug";
  label: string;
  data?: Record<string, unknown>;
}

export interface GraphEdge {
  source: string;
  target: string;
  type: string;
  score?: number;
}

export interface KnowledgeGraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
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
}

async function fetchJSON<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${API_BASE}${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  const resp = await fetch(url.toString());
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

export async function getGeneInfo(symbol: string) {
  return fetchJSON<Record<string, unknown>>(`/api/genes/${symbol}`);
}

export async function getDiseaseTrials(disease: string) {
  return fetchJSON<Record<string, unknown>>(`/api/diseases/${disease}/trials`);
}

export async function getDrugAdverseEvents(drug: string) {
  return fetchJSON<Record<string, unknown>>(`/api/drugs/${drug}/adverse-events`);
}
