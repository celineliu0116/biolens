import type { GraphEdge, GraphNode, TopicCluster } from "@/lib/api";

export function filterGraphByTypes(
  nodes: GraphNode[],
  edges: GraphEdge[],
  enabledTypes: Set<GraphNode["type"]>
) {
  const filteredNodes = nodes.filter((node) => enabledTypes.has(node.type));
  const nodeIds = new Set(filteredNodes.map((n) => n.id));
  const filteredEdges = edges.filter(
    (edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target)
  );
  return { nodes: filteredNodes, edges: filteredEdges };
}

export function normalizeTopics(topics: TopicCluster[] | undefined): TopicCluster[] {
  if (!topics) return [];
  return topics
    .map((topic) => ({
      ...topic,
      highlights: topic.highlights.filter(Boolean),
    }))
    .filter((topic) => topic.count > 0 || topic.highlights.length > 0);
}
