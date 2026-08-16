/**
 * Aggregated graph counters for Blueprint footer status bar.
 * Counts delegate to the canonical Blueprint metrics contract so view/footer
 * semantics cannot diverge.
 */

import { computeCanonicalBlueprintMetrics } from "../blueprint-metrics";
import type { SoftwareGraph } from "../types";

export interface BlueprintGraphStats {
  moduleCount: number;
  fileCount: number;
  dependencyCount: number;
}

export function computeBlueprintGraphStats(
  graph: SoftwareGraph | null | undefined,
  filesAnalyzed = 0,
): BlueprintGraphStats {
  const metrics = computeCanonicalBlueprintMetrics(graph, { filesAnalyzed });
  return {
    moduleCount: metrics.modules,
    fileCount: metrics.files,
    dependencyCount: metrics.dependencies,
  };
}

export function formatRelativeFreshness(updatedAt: string | undefined): string {
  if (!updatedAt) return "—";
  const parsed = Date.parse(updatedAt);
  if (!Number.isFinite(parsed)) return "—";

  const deltaMs = Date.now() - parsed;
  if (deltaMs < 0) return "gerade eben";

  const minutes = Math.floor(deltaMs / 60_000);
  if (minutes < 1) return "gerade eben";
  if (minutes < 60) return `vor ${minutes} Min`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `vor ${hours} Std`;

  const days = Math.floor(hours / 24);
  return `vor ${days} Tg`;
}
