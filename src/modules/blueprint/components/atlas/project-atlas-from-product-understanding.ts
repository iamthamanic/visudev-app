/**
 * Wire Product Understanding → AtlasProjection (PU-07).
 * Location: src/modules/blueprint/components/atlas/project-atlas-from-product-understanding.ts
 */

import { buildSemanticSystemModel } from "../../../../../shared/semantic-system-model.js";
import {
  buildProductUnderstanding,
  projectAtlasProductMap,
} from "../../../../../shared/product-understanding/index.js";
import { getNodeKindColor } from "../infrastructure/_colors.js";
import type { SoftwareGraph, SoftwareGraphGroup, SoftwareGraphNodeKind } from "../../types";
import type { AtlasProjection, AtlasProjectionOptions } from "./_projection.js";

/**
 * Build Atlas primary layer exclusively from ProductUnderstanding product semantics.
 */
export function projectAtlasFromProductUnderstanding(
  graph: SoftwareGraph,
  options: AtlasProjectionOptions = {},
): AtlasProjection {
  const semantic = buildSemanticSystemModel(graph);
  const productModel = buildProductUnderstanding({
    projectId: graph.projectId,
    analyzedAt: graph.analyzedAt,
    semantic,
    software: graph,
  });
  const map = projectAtlasProductMap(productModel, {
    searchQuery: options.searchQuery,
  });

  const nodes = map.nodes.map((node) => ({
    ...node,
    color: getNodeKindColor((node.kind || "module") as SoftwareGraphNodeKind),
  }));

  return {
    nodes,
    edges: map.edges,
    groups: map.groups as SoftwareGraphGroup[],
    inspectorGroups: map.inspectorGroups as SoftwareGraphGroup[],
    semanticEntities: map.semanticEntities,
    sourceGraphNodeIdBySemanticId: map.sourceGraphNodeIdBySemanticId,
    condensed: map.condensed,
    totalNodes: map.totalNodes,
    visibleNodes: map.visibleNodes,
  };
}
