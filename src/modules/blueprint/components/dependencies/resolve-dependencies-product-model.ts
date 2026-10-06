/**
 * Resolve Product Understanding impact map for Dependencies (PU-09).
 * Incomplete engine semantic payloads fall back to the shared builder.
 * Location: src/modules/blueprint/components/dependencies/resolve-dependencies-product-model.ts
 */

import { buildSemanticSystemModel } from "../../../../../shared/semantic-system-model.js";
import type { SemanticSystemModel } from "../../../../../shared/semantic-system-model.types.js";
import {
  buildProductUnderstanding,
  projectDependenciesImpactMap,
  type DependenciesImpactMapProjection,
  type ProductUnderstandingModel,
} from "../../../../../shared/product-understanding/index.js";
import type { BlueprintData, SoftwareGraph } from "../../types";

function isSemanticSystemModel(value: unknown): value is SemanticSystemModel {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return Array.isArray(record.entities) && Array.isArray(record.memberships);
}

function resolveDependenciesSemanticModel(
  blueprint: BlueprintData,
  graph: SoftwareGraph,
): SemanticSystemModel {
  if (isSemanticSystemModel(blueprint.semanticSystemModel)) {
    const model = blueprint.semanticSystemModel;
    const complete =
      Array.isArray(model.relations) &&
      model.entities.every(
        (entity) =>
          entity &&
          typeof entity === "object" &&
          Array.isArray(entity.evidence) &&
          entity.metadata != null &&
          typeof entity.confidence === "number",
      );
    if (complete) return model;
  }
  return buildSemanticSystemModel(graph);
}

export function resolveDependenciesProductModel(
  blueprint: BlueprintData,
  graph: SoftwareGraph | null | undefined = blueprint.graph,
): ProductUnderstandingModel | null {
  if (!graph) return null;
  const semantic = resolveDependenciesSemanticModel(blueprint, graph);
  return buildProductUnderstanding({
    projectId: graph.projectId,
    analyzedAt: graph.analyzedAt,
    semantic,
    software: graph,
  });
}

export function resolveDependenciesImpactProjection(
  blueprint: BlueprintData,
  graph: SoftwareGraph | null | undefined = blueprint.graph,
  options: { focusConceptId?: string | null; searchQuery?: string } = {},
): DependenciesImpactMapProjection | null {
  const product = resolveDependenciesProductModel(blueprint, graph);
  if (!product) return null;
  return projectDependenciesImpactMap(product, options);
}
