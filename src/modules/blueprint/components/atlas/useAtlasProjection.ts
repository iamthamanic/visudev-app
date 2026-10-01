import { useMemo } from "react";
import { buildSemanticSystemModel } from "../../../../../shared/semantic-system-model.js";
import type { BlueprintData } from "../../types";
import { projectAtlasSemanticModel, type AtlasProjection } from "./_projection.js";

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
  const model = useMemo(() => (graph ? buildSemanticSystemModel(graph) : null), [graph]);
  return useMemo(() => {
    if (!graph || !model) return EMPTY_PROJECTION;
    return projectAtlasSemanticModel(graph, model, { searchQuery });
  }, [graph, model, searchQuery]);
}
