import { describe, expect, it } from "vitest";

import type { GraphEdge, GraphNode } from "./api";
import { filterGraphByTypes, normalizeTopics } from "./graph";

describe("filterGraphByTypes", () => {
  it("keeps only nodes and edges that match enabled types", () => {
    const nodes: GraphNode[] = [
      { id: "gene:tp53", type: "gene", label: "TP53" },
      { id: "EFO_1", type: "disease", label: "Disease" },
      { id: "pmid:1", type: "paper", label: "Paper" },
    ];
    const edges: GraphEdge[] = [
      { source: "gene:tp53", target: "EFO_1", type: "associated_with" },
      { source: "gene:tp53", target: "pmid:1", type: "documented_in" },
    ];

    const filtered = filterGraphByTypes(nodes, edges, new Set(["gene", "disease"]));
    expect(filtered.nodes).toHaveLength(2);
    expect(filtered.edges).toHaveLength(1);
    expect(filtered.edges[0].target).toBe("EFO_1");
  });
});

describe("normalizeTopics", () => {
  it("removes empty highlights and irrelevant topics", () => {
    const topics = normalizeTopics([
      { id: "a", label: "A", count: 0, highlights: [] },
      { id: "b", label: "B", count: 2, highlights: ["", "Oncology"] },
    ]);

    expect(topics).toHaveLength(1);
    expect(topics[0].highlights).toEqual(["Oncology"]);
  });
});
