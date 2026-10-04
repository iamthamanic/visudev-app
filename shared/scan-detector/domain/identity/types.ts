/**
 * Identity match outcomes for ScanDetector evidence fusion (SDE-05).
 * Location: shared/scan-detector/domain/identity/types.ts
 */

import {
  dominantCanonicalKnowledgeStatus,
  isKnowledgeStatus,
  toLegacyScanKnowledgeStatus,
} from "../../epistemic.js";
import type { ScanEvidence, ScanFact, ScanKnowledgeStatus } from "../../types.js";

/** Conservative resolution outcome — no aggressive auto-merge. */
export type IdentityMatchStatus = "confirmed" | "probable" | "unresolved" | "conflicted";

export type IdentityMatchRuleId =
  | "exact-subject-id"
  | "scoped-subject-id"
  | "semantic-key"
  | "file-path-line"
  | "unresolved";

export interface IdentityCandidate {
  fact: ScanFact;
  evidence: ScanEvidence[];
}

export interface IdentityMatchRecord {
  id: string;
  status: IdentityMatchStatus;
  ruleId: IdentityMatchRuleId;
  /** Canonical subject id after fusion (app-scope safe). */
  subjectId: string;
  objectId?: string;
  factIds: string[];
  evidenceIds: string[];
  /** Human-readable reason for audit / inspector. */
  rationale: string;
}

export interface EvidenceFusionResult {
  facts: ScanFact[];
  evidence: ScanEvidence[];
  matches: IdentityMatchRecord[];
}

export interface SemanticIdentityKey {
  kind: string;
  applicationId?: string;
  /** Stable semantic token, e.g. `GET /api/users` — never secrets. */
  key: string;
}

export function readSemanticKey(fact: ScanFact): SemanticIdentityKey | null {
  const attrs = fact.attributes ?? {};
  const key = attrs.semanticKey;
  if (typeof key !== "string" || key.trim().length === 0) return null;
  const applicationId =
    typeof attrs.applicationId === "string" && attrs.applicationId.trim()
      ? attrs.applicationId.trim()
      : undefined;
  return { kind: fact.kind, applicationId, key: key.trim() };
}

export function isLlmOnlyEvidence(evidence: readonly ScanEvidence[]): boolean {
  if (evidence.length === 0) return false;
  return evidence.every(
    (item) => item.provenance.originKind === "llm" || item.provenance.llmSuggested === true,
  );
}

export function dominantKnowledgeStatus(
  statuses: readonly ScanKnowledgeStatus[],
): ScanKnowledgeStatus {
  // Legacy wire priority (existing fusion consumers).
  if (statuses.includes("conflicted") || statuses.includes("CONFLICTED")) return "conflicted";
  if (statuses.includes("verified") || statuses.includes("VERIFIED")) return "verified";
  if (statuses.includes("detected")) return "detected";
  if (statuses.includes("observed")) return "observed";
  if (statuses.includes("SUPPORTED")) return "detected";
  if (statuses.includes("inferred") || statuses.includes("INTERPRETED")) return "inferred";
  if (statuses.includes("unknown") || statuses.includes("UNKNOWN")) return "unknown";
  if (statuses.some((status) => isKnowledgeStatus(status))) {
    return toLegacyScanKnowledgeStatus(dominantCanonicalKnowledgeStatus(statuses));
  }
  return "unknown";
}
