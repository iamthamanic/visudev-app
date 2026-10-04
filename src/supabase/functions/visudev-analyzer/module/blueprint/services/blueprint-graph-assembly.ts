/** Builds VisuDevGraph from facts — authoritative or transport-capped (#377). */

import type { CodeFact } from "../../dto/blueprint/blueprint-document.dto.ts";
import type { RouteScope } from "../../dto/blueprint/route-scope.dto.ts";
import type { VisuDevGraph } from "../../dto/graph/visudev-graph.dto.ts";
import { buildVisuDevGraphFromFacts } from "../graph/fact-graph.mapper.ts";
import {
  capGraphForExport,
  sanitizeAuthoritativeGraph,
} from "../internal/export-sanitizer.ts";

export function assembleBlueprintGraph(
  facts: CodeFact[],
  routeScopes: RouteScope[],
  options?: { applyExportCap?: boolean },
): VisuDevGraph {
  const built = buildVisuDevGraphFromFacts(facts, routeScopes);
  if (options?.applyExportCap === false) {
    return sanitizeAuthoritativeGraph(built);
  }
  return capGraphForExport(built);
}
