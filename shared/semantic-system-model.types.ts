/**
 * Semantic Blueprint model derived from the neutral SoftwareGraph.
 *
 * v2 (#379): expanded taxonomy + KnowledgeStatus per entity/relation.
 * This layer never replaces the SoftwareGraph.
 */

import type { KnowledgeStatus } from "./scan-detector/epistemic.js";

/**
 * SemanticSystemModel v2 taxonomy (PR-05).
 * Legacy v1 kinds `component` and `use-case` remain readable for compatibility.
 */
export type SemanticEntityKind =
  | "application"
  | "business-domain"
  | "capability"
  | "resource"
  | "service"
  | "technical-module"
  | "endpoint"
  | "data-store"
  | "external-system"
  | "security-control"
  | "deployment-unit"
  | "runtime"
  | "execution-flow"
  /** @deprecated v1 alias — prefer technical-module */
  | "component"
  /** @deprecated v1 alias — prefer capability */
  | "use-case";

export type SemanticRelationKind =
  | "contains"
  | "depends-on"
  | "calls"
  | "accesses-data"
  | "communicates-with"
  | "authenticates"
  | "validates";

export type SemanticEvidenceSource = "graph-node" | "graph-edge" | "graph-evidence";

export interface SemanticEvidenceRef {
  source: SemanticEvidenceSource;
  refId: string;
}

export interface SemanticEntity {
  id: string;
  kind: SemanticEntityKind;
  label: string;
  confidence: number;
  /** Canonical KnowledgeStatus (VERIFIED/SUPPORTED/INTERPRETED/UNKNOWN/CONFLICTED). */
  knowledgeStatus: KnowledgeStatus;
  evidence: SemanticEvidenceRef[];
  metadata: Record<string, unknown>;
}

/**
 * Connects a low-level graph node to one semantic level. A graph node may have
 * multiple memberships (for example a service entity and its business domain),
 * which keeps roll-up lossless while allowing each view to pick its level.
 */
export interface SemanticMembership {
  graphNodeId: string;
  semanticEntityId: string;
  confidence: number;
  evidence: SemanticEvidenceRef[];
}

export interface SemanticRelation {
  id: string;
  kind: SemanticRelationKind;
  sourceId: string;
  targetId: string;
  confidence: number;
  knowledgeStatus: KnowledgeStatus;
  evidence: SemanticEvidenceRef[];
  metadata: Record<string, unknown>;
}

export interface SemanticSystemModel {
  /** v2 is current; builders may still emit version 1 for transitional snapshots. */
  version: 1 | 2;
  projectId: string;
  analyzedAt: string;
  entities: SemanticEntity[];
  memberships: SemanticMembership[];
  relations: SemanticRelation[];
}

/** Required v2 kinds for Product Readiness (#379). */
export const SEMANTIC_V2_REQUIRED_KINDS: readonly SemanticEntityKind[] = [
  "application",
  "business-domain",
  "capability",
  "resource",
  "service",
  "technical-module",
  "endpoint",
  "data-store",
  "external-system",
  "security-control",
  "deployment-unit",
  "runtime",
  "execution-flow",
] as const;
