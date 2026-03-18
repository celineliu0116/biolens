"use client";

import { useEffect, useRef, useCallback } from "react";
import * as d3 from "d3";
import type { GraphNode, GraphEdge } from "@/lib/api";

interface Props {
  nodes: GraphNode[];
  edges: GraphEdge[];
  onNodeClick?: (node: GraphNode) => void;
}

const NODE_COLORS: Record<string, string> = {
  gene: "#3b82f6",
  disease: "#f43f5e",
  trial: "#22c55e",
  drug: "#f59e0b",
  paper: "#a78bfa",
};

const NODE_RADIUS: Record<string, number> = {
  gene: 18,
  disease: 14,
  trial: 10,
  drug: 12,
  paper: 9,
};

interface SimNode extends d3.SimulationNodeDatum, GraphNode {}
interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  type: string;
  score?: number;
}

export default function KnowledgeGraph({ nodes, edges, onNodeClick }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const render = useCallback(() => {
    if (!svgRef.current || nodes.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const container = svgRef.current.parentElement;
    const width = container?.clientWidth || 900;
    const height = container?.clientHeight || 600;

    svg.attr("viewBox", `0 0 ${width} ${height}`);

    const simNodes: SimNode[] = nodes.map((n) => ({ ...n }));
    const simLinks: SimLink[] = edges
      .map((e) => ({
        source: e.source,
        target: e.target,
        type: e.type,
        score: e.score,
      }))
      .filter((e) => {
        const hasSource = simNodes.some((n) => n.id === e.source);
        const hasTarget = simNodes.some((n) => n.id === e.target);
        return hasSource && hasTarget;
      });

    const g = svg.append("g");

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 5])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });

    svg.call(zoom);

    svg
      .append("defs")
      .append("marker")
      .attr("id", "arrowhead")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 20)
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", "#475569");

    const simulation = d3
      .forceSimulation(simNodes)
      .force(
        "link",
        d3
          .forceLink<SimNode, SimLink>(simLinks)
          .id((d) => d.id)
          .distance(120)
      )
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(30));

    const link = g
      .append("g")
      .selectAll("line")
      .data(simLinks)
      .join("line")
      .attr("stroke", "#334155")
      .attr("stroke-width", (d) => Math.max(1, (d.score || 0.3) * 3))
      .attr("stroke-opacity", 0.6)
      .attr("marker-end", "url(#arrowhead)");

    const drag = d3
      .drag<SVGGElement, SimNode>()
      .on("start", (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on("drag", (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on("end", (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });

    const nodeGroup = g
      .append("g")
      .selectAll<SVGGElement, SimNode>("g")
      .data(simNodes)
      .join("g")
      .attr("cursor", "pointer")
      .call(drag);

    nodeGroup
      .append("circle")
      .attr("r", (d) => NODE_RADIUS[d.type] || 12)
      .attr("fill", (d) => NODE_COLORS[d.type] || "#6b7280")
      .attr("stroke", (d) => {
        const color = d3.color(NODE_COLORS[d.type] || "#6b7280");
        return color ? color.brighter(1).toString() : "#9ca3af";
      })
      .attr("stroke-width", 2)
      .attr("opacity", 0.85);

    nodeGroup
      .append("text")
      .text((d) => d.label.slice(0, 20))
      .attr("dy", (d) => (NODE_RADIUS[d.type] || 12) + 14)
      .attr("text-anchor", "middle")
      .attr("fill", "#cbd5e1")
      .attr("font-size", "11px")
      .attr("font-family", "Inter, sans-serif");

    nodeGroup
      .on("mousemove", (event) => {
        if (!tooltipRef.current) return;
        const tooltip = tooltipRef.current;
        const margin = 8;
        const cursorOffset = 12;
        const tooltipWidth = tooltip.offsetWidth;
        const tooltipHeight = tooltip.offsetHeight;

        let x = event.clientX + cursorOffset;
        let y = event.clientY + cursorOffset;

        if (x + tooltipWidth + margin > window.innerWidth) {
          x = Math.max(margin, window.innerWidth - tooltipWidth - margin);
        }
        if (y + tooltipHeight + margin > window.innerHeight) {
          y = event.clientY - tooltipHeight - cursorOffset;
        }
        if (y < margin) {
          y = margin;
        }

        tooltip.style.left = `${x}px`;
        tooltip.style.top = `${y}px`;
      })
      .on("mouseover", function (event, d) {
        d3.select(this).select("circle").transition().duration(150).attr("opacity", 1).attr("r", (NODE_RADIUS[d.type] || 12) + 4);
        if (tooltipRef.current) {
          const tooltip = tooltipRef.current;
          const margin = 8;
          const cursorOffset = 12;

          tooltip.innerHTML = `
            <strong>${d.label}</strong><br/>
            <span style="color: ${NODE_COLORS[d.type]}">${d.type.toUpperCase()}</span>
          `;
          tooltip.style.display = "block";

          const tooltipWidth = tooltip.offsetWidth;
          const tooltipHeight = tooltip.offsetHeight;
          let x = event.clientX + cursorOffset;
          let y = event.clientY + cursorOffset;

          if (x + tooltipWidth + margin > window.innerWidth) {
            x = Math.max(margin, window.innerWidth - tooltipWidth - margin);
          }
          if (y + tooltipHeight + margin > window.innerHeight) {
            y = event.clientY - tooltipHeight - cursorOffset;
          }
          if (y < margin) {
            y = margin;
          }

          tooltip.style.left = `${x}px`;
          tooltip.style.top = `${y}px`;
          tooltipRef.current.style.display = "block";
        }
      })
      .on("mouseout", function (_, d) {
        d3.select(this).select("circle").transition().duration(150).attr("opacity", 0.85).attr("r", NODE_RADIUS[d.type] || 12);
        if (tooltipRef.current) {
          tooltipRef.current.style.display = "none";
        }
      })
      .on("click", (_, d) => {
        if (onNodeClick) onNodeClick(d);
      });

    simulation.on("tick", () => {
      link
        .attr("x1", (d) => (d.source as SimNode).x || 0)
        .attr("y1", (d) => (d.source as SimNode).y || 0)
        .attr("x2", (d) => (d.target as SimNode).x || 0)
        .attr("y2", (d) => (d.target as SimNode).y || 0);

      nodeGroup.attr("transform", (d) => `translate(${d.x || 0},${d.y || 0})`);
    });

    return () => {
      simulation.stop();
    };
  }, [nodes, edges, onNodeClick]);

  useEffect(() => render(), [render]);

  return (
    <div className="relative h-full w-full">
      <svg ref={svgRef} className="h-full w-full" />
      <div ref={tooltipRef} className="d3-tooltip" style={{ display: "none" }} />
      {nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-slate-500">
          <div className="text-center">
            <svg className="mx-auto mb-3 h-16 w-16 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            <p className="text-lg font-medium">No graph data yet</p>
            <p className="mt-1 text-sm">Search for a gene, disease, or drug to explore connections</p>
          </div>
        </div>
      )}
      {nodes.length > 0 && (
        <div className="absolute bottom-4 left-4 flex gap-4 rounded-lg border border-white/10 bg-black/40 px-4 py-2 text-xs backdrop-blur-sm">
          {Object.entries(NODE_COLORS).map(([type, color]) => (
            <div key={type} className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
              <span className="capitalize text-slate-400">{type}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
