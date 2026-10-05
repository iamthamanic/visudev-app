/**
 * Canonical Product Understanding contracts (PU-01 / #422).
 * Architecture-agnostic read model over Truth layers — no React, no providers.
 * Location: shared/product-understanding.types.ts
 */

import type { KnowledgeStatus } from "./scan-detector/epistemic.js";

/** Contract version — bump only on breaking shape changes. */
export const PRODUCT_UNDERSTANDING_MODEL_VERSION = 1 as const;

export type ProductUnderstandingModelVersion = typeof PRODUCT_UNDERSTANDING_MODEL_VERSION;

/**
 * Human-facing concept kinds. `unknown` is explicit — never invent a kind
 * when evidence does not support classification.
 */
export type ProductConceptKind =
  | "application"
  | "product-area"
  | "capability"
  | "information"
  | "system-part"
  | "external-system"
  | "user-action"
  | "unknown";

/** Where a Product Understanding assertion came from (Truth / scan refs only). */
export type ProductEvidenceSource =
  | "software-graph"
  | "semantic-system-model"
  | "ui-interaction-graph"
  | "data-lineage"
  | "scan";

/**
 * Evidence pointer — redacted labels/summaries + IDs only.
 * Never store secrets or raw source payloads.
 */
export interface ProductEvidenceRef {
  source: ProductEvidenceSource;
  refId: string;
  summary?: string;
}

export interface ProductConcept {
  id: string;
  kind: ProductConceptKind;
  label: string;
  /** Short human summary; omit rather than invent. */
  summary?: string;
  knowledgeStatus: KnowledgeStatus;
  confidence: number;
  evidence: ProductEvidenceRef[];
  /**
   * Optional technical memberships (a node may map to several concepts).
   * Same shape as evidence refs — still ID-only.
   */
  technicalRefs?: ProductEvidenceRef[];
}

export type ProductRelationKind =
  | "contains"
  | "enables"
  | "uses"
  | "impacts"
  | "flows-to"
  | "belongs-to"
  | "triggers";

/**
 * Typed edge between concepts. Authoritative only when evidence is non-empty
 * (see `isAuthoritativeProductRelation`) — name-only edges are never authoritative.
 */
export interface ProductRelation {
  id: string;
  kind: ProductRelationKind;
  sourceConceptId: string;
  targetConceptId: string;
  knowledgeStatus: KnowledgeStatus;
  confidence: number;
  evidence: ProductEvidenceRef[];
}

export interface ProductImpactHint {
  id: string;
  fromConceptId: string;
  toConceptId: string;
  summary: string;
  knowledgeStatus: KnowledgeStatus;
  evidence: ProductEvidenceRef[];
}

export type ProductStoryStepRole = "actor" | "action" | "system" | "data" | "outcome";

export interface ProductStoryStep {
  conceptId: string;
  role: ProductStoryStepRole;
  label: string;
}

export interface ProductUserSystemStory {
  id: string;
  title: string;
  summary: string;
  steps: ProductStoryStep[];
  knowledgeStatus: KnowledgeStatus;
  evidence: ProductEvidenceRef[];
}

export interface ProductDataMeaning {
  id: string;
  /** Typically an `information` concept. */
  conceptId: string;
  businessMeaning: string;
  knowledgeStatus: KnowledgeStatus;
  evidence: ProductEvidenceRef[];
}

export type ProductExplanationLevel = "product" | "system" | "evidence";

export interface ProductExplanation {
  id: string;
  conceptId: string;
  level: ProductExplanationLevel;
  text: string;
  knowledgeStatus: KnowledgeStatus;
  evidence: ProductEvidenceRef[];
}

/**
 * Derived Product Understanding read model.
 * Does not replace SoftwareGraph / SemanticSystemModel / UIInteractionGraph / DataLineage.
 */
export interface ProductUnderstandingModel {
  version: ProductUnderstandingModelVersion;
  projectId: string;
  analyzedAt: string;
  concepts: ProductConcept[];
  relations: ProductRelation[];
  impacts: ProductImpactHint[];
  stories: ProductUserSystemStory[];
  dataMeanings: ProductDataMeaning[];
  explanations: ProductExplanation[];
}

export const PRODUCT_CONCEPT_KINDS: readonly ProductConceptKind[] = [
  "application",
  "product-area",
  "capability",
  "information",
  "system-part",
  "external-system",
  "user-action",
  "unknown",
] as const;
