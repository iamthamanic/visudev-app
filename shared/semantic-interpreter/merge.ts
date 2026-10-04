/**
 * Merge INTERPRETED LLM annotations onto a deterministic SemanticSystemModel (PR-19).
 * Never upgrades or overwrites VERIFIED/SUPPORTED claims.
 * Location: shared/semantic-interpreter/merge.ts
 */

import {
  applyOriginKnowledgePolicy,
  isAuthoritativeKnowledgeStatus,
} from "../scan-detector/epistemic.js";
import type { SemanticEntity, SemanticSystemModel } from "../semantic-system-model.types.js";
import type { SemanticInterpretationAnnotation, SemanticInterpretationResult } from "./types.js";

function forceInterpretedProvenance(
  annotation: SemanticInterpretationAnnotation,
): SemanticInterpretationAnnotation {
  const knowledgeStatus = applyOriginKnowledgePolicy(annotation.provenance.knowledgeStatus, "llm");
  return {
    ...annotation,
    confidence: Math.min(1, Math.max(0, Number(annotation.confidence) || 0)),
    provenance: {
      originKind: "llm",
      knowledgeStatus: knowledgeStatus === "CONFLICTED" ? "CONFLICTED" : "INTERPRETED",
      modelId: String(annotation.provenance.modelId || "unknown"),
      promptVersion: String(annotation.provenance.promptVersion || "unknown"),
      evidence: Array.isArray(annotation.provenance.evidence) ? annotation.provenance.evidence : [],
    },
  };
}

function entityFromAnnotation(annotation: SemanticInterpretationAnnotation): SemanticEntity {
  const forced = forceInterpretedProvenance(annotation);
  return {
    id: forced.entityId,
    kind: forced.kind || "capability",
    label: forced.label || forced.entityId,
    confidence: forced.confidence,
    knowledgeStatus:
      forced.provenance.knowledgeStatus === "CONFLICTED" ? "CONFLICTED" : "INTERPRETED",
    evidence: forced.provenance.evidence,
    metadata: {
      originKind: "llm",
      modelId: forced.provenance.modelId,
      promptVersion: forced.provenance.promptVersion,
      ...(forced.note ? { interpretationNote: forced.note } : {}),
    },
  };
}

/**
 * Apply interpreter annotations onto a base model.
 * Authoritative entities stay byte-stable aside from unrelated new INTERPRETED entities.
 */
export function mergeSemanticInterpretations(
  base: SemanticSystemModel,
  result: SemanticInterpretationResult,
): SemanticSystemModel {
  if (result.status !== "ok" || result.annotations.length === 0) {
    return base;
  }

  const entities = base.entities.map((entity) => ({ ...entity }));
  const byId = new Map(entities.map((entity) => [entity.id, entity]));

  for (const raw of result.annotations) {
    const annotation = forceInterpretedProvenance(raw);
    const existing = byId.get(annotation.entityId);
    if (existing && isAuthoritativeKnowledgeStatus(existing.knowledgeStatus)) {
      // LLM must not overwrite or upgrade VERIFIED/SUPPORTED.
      continue;
    }
    if (existing) {
      const next: SemanticEntity = {
        ...existing,
        label: annotation.label ?? existing.label,
        kind: annotation.kind ?? existing.kind,
        confidence: Math.max(existing.confidence, annotation.confidence),
        knowledgeStatus: existing.knowledgeStatus === "CONFLICTED" ? "CONFLICTED" : "INTERPRETED",
        evidence: [...existing.evidence, ...annotation.provenance.evidence],
        metadata: {
          ...existing.metadata,
          originKind: "llm",
          modelId: annotation.provenance.modelId,
          promptVersion: annotation.provenance.promptVersion,
          ...(annotation.note ? { interpretationNote: annotation.note } : {}),
        },
      };
      const index = entities.findIndex((entity) => entity.id === existing.id);
      entities[index] = next;
      byId.set(next.id, next);
      continue;
    }
    const created = entityFromAnnotation(annotation);
    entities.push(created);
    byId.set(created.id, created);
  }

  return {
    ...base,
    entities,
  };
}
