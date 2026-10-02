/**
 * Semantic shadow compare for SoftwareGraph legacy vs engine (SDE-06).
 * Location: shared/scan-detector/application/shadow-compare-graphs.ts
 */

import { compareShadowParity, extractSemanticBaseline } from "../../migration-baseline.js";
import type { ShadowParityResult } from "../../migration-baseline.types.js";
import type { SoftwareGraph } from "../../software-graph.types.js";

export interface ShadowCompareGraphsInput {
  projectId: string;
  legacy: SoftwareGraph;
  engine: SoftwareGraph;
  enrichment?: "off" | "on" | "unknown";
  routes?: ReadonlyArray<{ id?: string } | null> | null;
}

/**
 * Compare legacy vs engine graphs via semantic baseline fingerprints
 * (Missing/Extra/Changed), not object order.
 */
export function shadowCompareSoftwareGraphs(input: ShadowCompareGraphsInput): ShadowParityResult {
  const enrichment = input.enrichment ?? "off";
  const expected = extractSemanticBaseline({
    projectId: input.projectId,
    enrichment,
    graph: input.legacy,
    routes: input.routes,
  });
  const actual = extractSemanticBaseline({
    projectId: input.projectId,
    enrichment,
    graph: input.engine,
    routes: input.routes,
  });
  return compareShadowParity(expected, actual);
}
