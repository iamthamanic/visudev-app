/**
 * Atlas projection hook — Product Understanding product-domain map (PU-07).
 */

import { useMemo } from "react";
import type { BlueprintData } from "../../types";
import type { AtlasProjection } from "./_projection.js";
import { projectAtlasFromProductUnderstanding } from "./project-atlas-from-product-understanding.js";

const EMPTY_PROJECTION: AtlasProjection = {
  nodes: [],
  edges: [],
  groups: [],
  inspectorGroups: [],
  semanticEntities: [],
  sourceGraphNodeIdBySemanticId: {},
  condensed: false,
  totalNodes: 0,
  visibleNodes: 0,
};

export function useAtlasProjection(
  graph: BlueprintData["graph"],
  searchQuery: string,
): AtlasProjection {
  return useMemo(() => {
    if (!graph) return EMPTY_PROJECTION;
    return projectAtlasFromProductUnderstanding(graph, { searchQuery });
  }, [graph, searchQuery]);
}
