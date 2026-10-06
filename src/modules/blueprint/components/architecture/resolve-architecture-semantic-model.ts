/**
 * Resolve SemanticSystemModel authority for Architecture (PR-07).
 * Prefers engine-provided blueprint.semanticSystemModel; otherwise shared builder.
 * Never invents UI-side classification.
 * Location: src/modules/blueprint/components/architecture/resolve-architecture-semantic-model.ts
 */

import { buildSemanticSystemModel } from "../../../../../shared/semantic-system-model.js";
import type { SemanticSystemModel } from "../../../../../shared/semantic-system-model.types.js";
import type { BlueprintData, SoftwareGraph } from "../../types";

function isSemanticSystemModel(value: unknown): value is SemanticSystemModel {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return Array.isArray(record.entities) && Array.isArray(record.memberships);
}

/**
 * Single semantic authority for ArchitectureView.
 * Product slice must not re-classify domains from folder names.
 * Incomplete engine payloads fall back to the shared builder.
 */
export function resolveArchitectureSemanticModel(
  blueprint: BlueprintData,
  graph: SoftwareGraph | null | undefined = blueprint.graph,
): SemanticSystemModel | null {
  if (!graph) return null;
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
    if (complete) {
      if (model.version === 2 || model.entities.some((entity) => "knowledgeStatus" in entity)) {
        return model;
      }
      if (model.entities.length > 0) return model;
    }
  }
  return buildSemanticSystemModel(graph);
}
