/**
 * Optional Product Understanding interpretation (PU-03 / #424).
 * Provider-neutral enrichment for ambiguous concepts only — never overwrites VERIFIED/SUPPORTED.
 * Location: shared/product-understanding/interpretation.ts
 */

import {
  applyOriginKnowledgePolicy,
  isAuthoritativeKnowledgeStatus,
  type CoverageStatus,
} from "../scan-detector/epistemic.js";
import type {
  ProductConcept,
  ProductConceptKind,
  ProductEvidenceRef,
  ProductUnderstandingModel,
} from "../product-understanding.types.js";
import { PRODUCT_CONCEPT_KINDS } from "../product-understanding.types.js";

export const PRODUCT_UNDERSTANDING_INTERPRETER_PROMPT_VERSION =
  "product-understanding-interpreter-v1";

function coerceKind(value: unknown): ProductConceptKind {
  if (typeof value === "string" && (PRODUCT_CONCEPT_KINDS as readonly string[]).includes(value)) {
    return value as ProductConceptKind;
  }
  return "unknown";
}
export type ProductUnderstandingInterpretationStatus = "ok" | "unavailable" | "skipped";

export interface ProductUnderstandingInterpretationProvenance {
  originKind: "llm";
  knowledgeStatus: "INTERPRETED" | "CONFLICTED";
  modelId: string;
  promptVersion: string;
  evidence: ProductEvidenceRef[];
}

export interface ProductUnderstandingAnnotation {
  conceptId: string;
  label?: string;
  summary?: string;
  kind?: ProductConceptKind;
  confidence: number;
  provenance: ProductUnderstandingInterpretationProvenance;
}

export interface ProductUnderstandingInterpretationResult {
  status: ProductUnderstandingInterpretationStatus;
  coverage: CoverageStatus;
  reason?: string;
  annotations: ProductUnderstandingAnnotation[];
  modelId?: string;
  promptVersion?: string;
}

export interface ProductUnderstandingInterpreterInput {
  model: ProductUnderstandingModel;
  /** Ambiguous concept ids selected for interpretation. */
  ambiguousConceptIds: string[];
  /** Redacted snippets only — never secrets or raw source. */
  redactedEvidence: Array<{ refId: string; text: string }>;
  modelId?: string;
  promptVersion?: string;
}

export interface ProductUnderstandingInterpreterPort {
  interpret(
    input: ProductUnderstandingInterpreterInput,
  ): Promise<ProductUnderstandingInterpretationResult>;
}

export function isAmbiguousProductConcept(concept: ProductConcept): boolean {
  if (isAuthoritativeKnowledgeStatus(concept.knowledgeStatus)) return false;
  if (concept.knowledgeStatus === "UNKNOWN" || concept.knowledgeStatus === "CONFLICTED") {
    return true;
  }
  if (concept.knowledgeStatus === "INTERPRETED") return true;
  return concept.evidence.length === 0 || concept.confidence < 0.55;
}

/** Build redacted interpreter payload from deterministic PU model. */
export function buildProductUnderstandingInterpreterInput(
  model: ProductUnderstandingModel,
): ProductUnderstandingInterpreterInput {
  const ambiguous = model.concepts.filter(isAmbiguousProductConcept);
  const redactedEvidence: Array<{ refId: string; text: string }> = [];
  for (const concept of ambiguous) {
    redactedEvidence.push({
      refId: concept.id,
      text: `${concept.kind}:${concept.label}`.slice(0, 160),
    });
    for (const evidence of concept.evidence.slice(0, 4)) {
      redactedEvidence.push({
        refId: evidence.refId,
        text: `${evidence.source}:${evidence.summary ?? concept.label}`.slice(0, 160),
      });
    }
  }
  return {
    model,
    ambiguousConceptIds: ambiguous.map((concept) => concept.id),
    redactedEvidence,
    promptVersion: PRODUCT_UNDERSTANDING_INTERPRETER_PROMPT_VERSION,
  };
}

function forceInterpreted(
  annotation: ProductUnderstandingAnnotation,
): ProductUnderstandingAnnotation {
  const knowledgeStatus = applyOriginKnowledgePolicy(annotation.provenance.knowledgeStatus, "llm");
  return {
    ...annotation,
    kind: annotation.kind ? coerceKind(annotation.kind) : annotation.kind,
    confidence: Math.min(1, Math.max(0, Number(annotation.confidence) || 0)),
    provenance: {
      originKind: "llm",
      knowledgeStatus: knowledgeStatus === "CONFLICTED" ? "CONFLICTED" : "INTERPRETED",
      modelId: String(annotation.provenance.modelId || "unknown"),
      promptVersion: String(
        annotation.provenance.promptVersion || PRODUCT_UNDERSTANDING_INTERPRETER_PROMPT_VERSION,
      ),
      evidence: Array.isArray(annotation.provenance.evidence) ? annotation.provenance.evidence : [],
    },
  };
}

/**
 * Merge interpreter annotations into a deterministic ProductUnderstandingModel.
 * Authoritative concepts stay unchanged; unknown conceptIds are ignored.
 */
export function mergeProductUnderstandingInterpretations(
  base: ProductUnderstandingModel,
  result: ProductUnderstandingInterpretationResult,
): ProductUnderstandingModel {
  if (result.status !== "ok" || result.annotations.length === 0) {
    return base;
  }

  const concepts = base.concepts.map((concept) => ({ ...concept }));
  const byId = new Map(concepts.map((concept) => [concept.id, concept]));

  for (const raw of result.annotations) {
    const annotation = forceInterpreted(raw);
    const existing = byId.get(annotation.conceptId);
    if (!existing) continue;
    if (isAuthoritativeKnowledgeStatus(existing.knowledgeStatus)) continue;

    const next: ProductConcept = {
      ...existing,
      label: annotation.label ?? existing.label,
      summary: annotation.summary ?? existing.summary,
      kind: annotation.kind ?? existing.kind,
      confidence: Math.max(existing.confidence, annotation.confidence),
      knowledgeStatus: existing.knowledgeStatus === "CONFLICTED" ? "CONFLICTED" : "INTERPRETED",
      evidence: [...existing.evidence, ...annotation.provenance.evidence],
    };
    const index = concepts.findIndex((concept) => concept.id === existing.id);
    concepts[index] = next;
    byId.set(next.id, next);
  }

  return { ...base, concepts };
}

export function createNullProductUnderstandingInterpreter(): ProductUnderstandingInterpreterPort {
  return {
    async interpret() {
      return {
        status: "unavailable",
        coverage: "UNAVAILABLE",
        reason: "No ProductUnderstanding interpreter provider configured",
        annotations: [],
        promptVersion: PRODUCT_UNDERSTANDING_INTERPRETER_PROMPT_VERSION,
      };
    },
  };
}
