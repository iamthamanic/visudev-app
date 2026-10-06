/**
 * Resolve Product Understanding execution stories (PU-10).
 * Location: src/modules/blueprint/components/execution/resolve-execution-product-model.ts
 */

import type { DataLineageGraph } from "../../../../../shared/data-lineage.types.js";
import type { UiInteractionGraph } from "../../../../../shared/ui-interaction-graph.types.js";
import { buildSemanticSystemModel } from "../../../../../shared/semantic-system-model.js";
import type { SemanticSystemModel } from "../../../../../shared/semantic-system-model.types.js";
import {
  buildProductUnderstanding,
  projectExecutionStories,
  type ExecutionStoriesProjection,
  type ProductUnderstandingModel,
} from "../../../../../shared/product-understanding/index.js";
import type { BlueprintData, SoftwareGraph } from "../../types";

function isSemanticSystemModel(value: unknown): value is SemanticSystemModel {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return Array.isArray(record.entities) && Array.isArray(record.memberships);
}

function resolveExecutionSemanticModel(
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

export function resolveExecutionProductModel(
  blueprint: BlueprintData,
  graph: SoftwareGraph | null | undefined = blueprint.graph,
): ProductUnderstandingModel | null {
  if (!graph) return null;
  const semantic = resolveExecutionSemanticModel(blueprint, graph);
  return buildProductUnderstanding({
    projectId: graph.projectId,
    analyzedAt: graph.analyzedAt,
    semantic,
    software: graph,
    ui: (blueprint.uiInteractionGraph as UiInteractionGraph | undefined) ?? null,
    lineage: (blueprint.dataLineage as DataLineageGraph | undefined) ?? null,
  });
}

export function resolveExecutionStoriesProjection(
  blueprint: BlueprintData,
  graph: SoftwareGraph | null | undefined = blueprint.graph,
): ExecutionStoriesProjection | null {
  const product = resolveExecutionProductModel(blueprint, graph);
  if (!product) return null;
  return projectExecutionStories(product, graph);
}
