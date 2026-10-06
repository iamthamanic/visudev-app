/**
 * Resolve Product Understanding + responsibility projection for Architecture (PU-08).
 * Location: src/modules/blueprint/components/architecture/resolve-architecture-product-model.ts
 */

import { buildSemanticSystemModel } from "../../../../../shared/semantic-system-model.js";
import {
  buildProductUnderstanding,
  projectArchitectureResponsibilities,
  type ArchitectureResponsibilityProjection,
  type ProductUnderstandingModel,
} from "../../../../../shared/product-understanding/index.js";
import type { BlueprintData, SoftwareGraph } from "../../types";
import { resolveArchitectureSemanticModel } from "./resolve-architecture-semantic-model.js";

export function resolveArchitectureProductModel(
  blueprint: BlueprintData,
  graph: SoftwareGraph | null | undefined = blueprint.graph,
): ProductUnderstandingModel | null {
  if (!graph) return null;
  const semantic =
    resolveArchitectureSemanticModel(blueprint, graph) ?? buildSemanticSystemModel(graph);
  return buildProductUnderstanding({
    projectId: graph.projectId,
    analyzedAt: graph.analyzedAt,
    semantic,
    software: graph,
  });
}

export function resolveArchitectureResponsibilityProjection(
  blueprint: BlueprintData,
  graph: SoftwareGraph | null | undefined = blueprint.graph,
): ArchitectureResponsibilityProjection | null {
  const product = resolveArchitectureProductModel(blueprint, graph);
  if (!product) return null;
  return projectArchitectureResponsibilities(product);
}
