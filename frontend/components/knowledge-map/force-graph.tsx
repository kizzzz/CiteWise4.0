"use client";

import { useEffect, useRef } from "react";
import * as d3 from "d3";

interface MapNode {
  id: string;
  label: string;
  authors: string | null;
  year: number | null;
  chunks: number;
}

interface MapEdge {
  source: string;
  target: string;
  weight: number;
  shared_topics: string[];
}

interface ForceGraphProps {
  nodes: MapNode[];
  edges: MapEdge[];
  onNodeClick?: (node: MapNode) => void;
}

export function ForceGraph({ nodes, edges, onNodeClick }: ForceGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || nodes.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;
    const g = svg.append("g");

    // Zoom
    svg.call(d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 5])
      .on("zoom", (event) => g.attr("transform", event.transform)) as any
    );

    // Color scale by year
    const years = nodes.map((n) => n.year || 2020);
    const minY = Math.min(...years);
    const maxY = Math.max(...years);
    const colorScale = d3.scaleSequential(d3.interpolateBlues).domain([minY, maxY || minY + 5]);

    // Size scale
    const maxChunks = Math.max(...nodes.map((n) => n.chunks), 1);
    const sizeScale = d3.scaleSqrt().domain([0, maxChunks]).range([8, 35]);

    // Build data for simulation
    const simNodes: any[] = nodes.map((n) => ({ ...n }));
    const simLinks: any[] = edges.map((e) => ({ ...e }));

    // Simulation
    const simulation = d3.forceSimulation(simNodes)
      .force("link", d3.forceLink(simLinks).id((d: any) => d.id).distance(120))
      .force("charge", d3.forceManyBody().strength(-200))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(40));

    // Links
    g.append("g")
      .selectAll("line")
      .data(simLinks)
      .join("line")
      .attr("stroke", (d: any) => (d.shared_topics?.length || 0) > 0 ? "#3b82f6" : "#f59e0b")
      .attr("stroke-width", (d: any) => Math.max(1, d.weight * 2))
      .attr("stroke-dasharray", (d: any) => (d.shared_topics?.length || 0) > 0 ? "none" : "5,5")
      .attr("opacity", 0.4);

    // Nodes
    const nodeGroup = g.append("g")
      .selectAll("g")
      .data(simNodes)
      .join("g")
      .on("click", (_event: any, d: any) => onNodeClick?.(d));

    // Make draggable
    (nodeGroup as any).call(
      d3.drag()
        .on("start", (event: any, d: any) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x; d.fy = d.y;
        })
        .on("drag", (event: any, d: any) => {
          d.fx = event.x; d.fy = event.y;
        })
        .on("end", (event: any, d: any) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null; d.fy = null;
        })
    );

    // Circles
    nodeGroup.append("circle")
      .attr("r", (d: any) => sizeScale(d.chunks))
      .attr("fill", (d: any) => colorScale(d.year || 2020))
      .attr("stroke", "white")
      .attr("stroke-width", 2)
      .attr("opacity", 0.85);

    // Labels
    nodeGroup.append("text")
      .text((d: any) => d.label.length > 15 ? d.label.substring(0, 15) + "..." : d.label)
      .attr("dx", (d: any) => sizeScale(d.chunks) + 5)
      .attr("dy", 4)
      .attr("font-size", "10px")
      .attr("fill", "#475569")
      .attr("font-weight", 600);

    // Tick
    simulation.on("tick", () => {
      g.selectAll("line")
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);
      nodeGroup.attr("transform", (d: any) => `translate(${d.x},${d.y})`);
    });

    return () => { simulation.stop(); };
  }, [nodes, edges, onNodeClick]);

  return <svg ref={svgRef} className="w-full h-full" style={{ background: "#f8fafc" }} />;
}
