/**
 * Resolve Product Understanding system topology for Infrastructure (PU-12).
 * Location: src/modules/blueprint/components/infrastructure/resolve-infrastructure-product-model.ts
 */

import { buildSemanticSystemModel } from "../../../../../shared/semantic-system-model.js";
import type { SemanticSystemModel } from "../../../../../shared/semantic-system-model.types.js";
import {
  buildProductUnderstanding,
  projectInfrastructureSystemTopology,
  type InfrastructureSystemTopologyProjection,
  type ProductUnderstandingModel,
} from "../../../../../shared/product-understanding/index.js";
import type { BlueprintData, SoftwareGraph } from "../../types";

function isSemanticSystemModel(value: unknown): value is SemanticSystemModel {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return Array.isArray(record.entities) && Array.isArray(record.memberships);
}

export function resolveInfrastructureProductModel(
  blueprint: BlueprintData,
  graph: SoftwareGraph | null | undefined = blueprint.graph,
): ProductUnderstandingModel | null {
  if (!graph) return null;
  const semantic = isSemanticSystemModel(blueprint.semanticSystemModel)
    ? (() => {
        const model = blueprint.semanticSystemModel as SemanticSystemModel;
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
        return complete ? model : buildSemanticSystemModel(graph);
      })()
    : buildSemanticSystemModel(graph);

  return buildProductUnderstanding({
    projectId: graph.projectId,
    analyzedAt: graph.analyzedAt,
    semantic,
    software: graph,
  });
}

export function resolveInfrastructureSystemTopologyProjection(
  blueprint: BlueprintData,
  graph: SoftwareGraph | null | undefined = blueprint.graph,
): InfrastructureSystemTopologyProjection | null {
  const product = resolveInfrastructureProductModel(blueprint, graph);
  if (!product) return null;
  return projectInfrastructureSystemTopology(product, { software: graph ?? null });
}
