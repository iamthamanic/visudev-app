/**
 * Treemap projection helpers — shared with AtlasTreemap UI.
 * Location: src/modules/blueprint/components/atlas/atlas-treemap-projection.ts
 */

import type { SoftwareGraph } from "../../types";

export interface TreemapCell {
  id: string;
  label: string;
  weight: number;
}

export function projectTreemapCells(graph: SoftwareGraph | null | undefined): TreemapCell[] {
  if (!graph) return [];
  const modules = graph.nodes.filter((node) => node.kind === "module" || node.kind === "domain");
  if (modules.length < 2) return [];
  const outbound = new Map<string, number>();
  for (const edge of graph.edges) {
    outbound.set(edge.sourceId, (outbound.get(edge.sourceId) ?? 0) + 1);
  }
  return modules
    .map((node) => ({
      id: node.id,
      label: node.label,
      weight: Math.max(1, outbound.get(node.id) ?? 1),
    }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 40);
}
