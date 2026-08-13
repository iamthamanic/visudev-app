/**
 * Atlas aggregate stats derived from SoftwareGraph nodes and blueprint file counts.
 * Honest-Core (P0-1): coveragePercent is null when no real metric exists —
 * never derived from node ratios (inverse heuristic lied).
 */

import type { BlueprintData, SoftwareGraph } from "../../types";

export interface AtlasAggregateStats {
  systems: number;
  services: number;
  modules: number;
  files: number;
  /** Null when the graph carries no coverage metric. Rendered as "unbekannt". */
  coveragePercent: number | null;
}

function metricValue(graph: SoftwareGraph, name: string): number | null {
  const metrics = Array.isArray(graph.metrics) ? graph.metrics : [];
  const match = metrics.find((metric) => metric.name === name);
  if (!match || !Number.isFinite(match.value)) return null;
  return Math.max(0, Math.round(match.value));
}

export function computeAtlasStats(
  graph: SoftwareGraph,
  filesAnalyzed: number,
): AtlasAggregateStats {
  const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
  const modulesFromNodes = nodes.filter((node) => node.kind === "module").length;
  const services = nodes.filter((node) => node.kind === "service").length;
  const fileNodes = nodes.filter((node) => node.kind === "file").length;
  const systems = nodes.filter((node) =>
    ["application", "service", "runtime"].includes(node.kind),
  ).length;
  const modules = metricValue(graph, "modules") ?? modulesFromNodes;
  const files = metricValue(graph, "files") ?? (filesAnalyzed > 0 ? filesAnalyzed : fileNodes);
  const coverageFromMetric = metricValue(graph, "coverage");
  const coveragePercent = coverageFromMetric != null ? Math.min(100, coverageFromMetric) : null;

  return {
    systems,
    services,
    modules,
    files,
    coveragePercent,
  };
}

export function atlasStatsFromBlueprint(blueprint: BlueprintData): AtlasAggregateStats | null {
  if (!blueprint.graph) return null;
  return computeAtlasStats(blueprint.graph, blueprint.filesAnalyzed ?? 0);
}
