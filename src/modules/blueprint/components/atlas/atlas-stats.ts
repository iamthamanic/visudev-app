/**
 * Atlas aggregate stats derived from the canonical Blueprint metrics contract.
 * Honest-Core: coveragePercent is null when no real metric exists.
 */

import { computeCanonicalBlueprintMetrics } from "../../blueprint-metrics";
import type { BlueprintData, SoftwareGraph } from "../../types";

export interface AtlasAggregateStats {
  systems: number;
  services: number;
  modules: number;
  files: number;
  /** Null when the graph carries no coverage metric. Rendered as "unbekannt". */
  coveragePercent: number | null;
}

export function computeAtlasStats(
  graph: SoftwareGraph,
  filesAnalyzed: number,
): AtlasAggregateStats {
  const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
  const canonical = computeCanonicalBlueprintMetrics(graph, { filesAnalyzed });
  const systems = nodes.filter((node) =>
    ["application", "service", "runtime"].includes(node.kind),
  ).length;

  return {
    systems,
    services: canonical.services,
    modules: canonical.modules,
    files: canonical.files,
    coveragePercent: canonical.coveragePercent,
  };
}

export function atlasStatsFromBlueprint(blueprint: BlueprintData): AtlasAggregateStats | null {
  if (!blueprint.graph) return null;
  return computeAtlasStats(blueprint.graph, blueprint.filesAnalyzed ?? 0);
}
