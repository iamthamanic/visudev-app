/**
 * Wire Product Understanding → AtlasProjection (PU-07).
 * When no corroborated product concepts exist, fall back to the existing semantic
 * Atlas projection so folder-first projects stay honest (never invent domains).
 * Location: src/modules/blueprint/components/atlas/project-atlas-from-product-understanding.ts
 */

import { buildSemanticSystemModel } from "../../../../../shared/semantic-system-model.js";
import {
  buildProductUnderstanding,
  projectAtlasProductMap,
} from "../../../../../shared/product-understanding/index.js";
import { getNodeKindColor } from "../infrastructure/_colors.js";
import type { SoftwareGraph, SoftwareGraphGroup, SoftwareGraphNodeKind } from "../../types";
import {
  projectAtlasSemanticModel,
  type AtlasProjection,
  type AtlasProjectionOptions,
} from "./_projection.js";

/**
 * Build Atlas primary layer from ProductUnderstanding product semantics.
 * Falls back to semantic overview only when the product map is empty.
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

  if (map.visibleNodes === 0) {
    return projectAtlasSemanticModel(graph, semantic, options);
  }

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
