/**
 * Resolve Product Understanding information-flow projection for Data (PU-11).
 * Location: src/modules/data/services/resolve-data-product-model.ts
 */

import { buildSemanticSystemModel } from "../../../../shared/semantic-system-model.js";
import type { SemanticSystemModel } from "../../../../shared/semantic-system-model.types.js";
import type { SoftwareGraph } from "../../../../shared/software-graph.types.js";
import type { DataLineageGraph } from "../../../../shared/data-lineage.types.js";
import {
  buildProductUnderstanding,
  projectDataInformationFlow,
  type DataInformationFlowProjection,
  type ProductUnderstandingModel,
} from "../../../../shared/product-understanding/index.js";

function isSemanticSystemModel(value: unknown): value is SemanticSystemModel {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return Array.isArray(record.entities) && Array.isArray(record.memberships);
}

export function resolveDataProductModel(input: {
  projectId: string;
  analyzedAt?: string;
  software: SoftwareGraph | null;
  lineage?: DataLineageGraph | null;
  semanticSystemModel?: unknown;
}): ProductUnderstandingModel | null {
  if (!input.software) return null;
  const semantic = isSemanticSystemModel(input.semanticSystemModel)
    ? (() => {
        const model = input.semanticSystemModel as SemanticSystemModel;
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
        return complete ? model : buildSemanticSystemModel(input.software!);
      })()
    : buildSemanticSystemModel(input.software);

  return buildProductUnderstanding({
    projectId: input.projectId,
    analyzedAt: input.analyzedAt ?? input.software.analyzedAt,
    semantic,
    software: input.software,
    lineage: input.lineage ?? null,
  });
}

export function resolveDataInformationFlowProjection(input: {
  projectId: string;
  analyzedAt?: string;
  software: SoftwareGraph | null;
  lineage?: DataLineageGraph | null;
  semanticSystemModel?: unknown;
}): DataInformationFlowProjection | null {
  const product = resolveDataProductModel(input);
  if (!product) return null;
  return projectDataInformationFlow(product, input.lineage ?? null);
}
