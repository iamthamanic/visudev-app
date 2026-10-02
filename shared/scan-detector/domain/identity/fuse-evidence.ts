/**
 * Conservative identity resolution + evidence fusion (SDE-05).
 * Location: shared/scan-detector/domain/identity/fuse-evidence.ts
 */

import { isAuthoritativeEvidence, type ScanEvidence, type ScanFact } from "../../types.js";
import { scopedSubjectId } from "../project-capabilities.js";
import {
  dominantKnowledgeStatus,
  isLlmOnlyEvidence,
  readSemanticKey,
  type EvidenceFusionResult,
  type IdentityCandidate,
  type IdentityMatchRecord,
  type IdentityMatchRuleId,
  type IdentityMatchStatus,
} from "./types.js";

export interface FuseEvidenceInput {
  facts: readonly ScanFact[];
  evidence: readonly ScanEvidence[];
  /** Optional default application scope for unscoped subjects. */
  defaultApplicationId?: string;
}

function evidenceForFact(
  fact: ScanFact,
  evidenceById: ReadonlyMap<string, ScanEvidence>,
): ScanEvidence[] {
  return fact.evidenceIds
    .map((id) => evidenceById.get(id))
    .filter((item): item is ScanEvidence => item != null);
}

function groupKey(fact: ScanFact): { ruleId: IdentityMatchRuleId; key: string } {
  const semantic = readSemanticKey(fact);
  if (semantic) {
    const app = semantic.applicationId ?? "_";
    return {
      ruleId: "semantic-key",
      key: `semantic:${app}:${semantic.kind}:${semantic.key}`,
    };
  }

  const attrs = fact.attributes ?? {};
  const filePath = typeof attrs.filePath === "string" ? attrs.filePath : null;
  const line = typeof attrs.line === "number" ? attrs.line : null;
  if (filePath && line != null) {
    return {
      ruleId: "file-path-line",
      key: `file:${filePath}:${line}:${fact.kind}`,
    };
  }

  if (fact.subjectId.includes("::")) {
    return { ruleId: "scoped-subject-id", key: `subject:${fact.kind}:${fact.subjectId}` };
  }

  return { ruleId: "exact-subject-id", key: `subject:${fact.kind}:${fact.subjectId}` };
}

function claimsConflict(left: ScanFact, right: ScanFact): boolean {
  if (left.kind !== right.kind) return true;
  if (left.objectId && right.objectId && left.objectId !== right.objectId) return true;
  const leftStatus = left.status;
  const rightStatus = right.status;
  // Detected/observed vs contradictory inferred about different objects already handled.
  // Explicit conflict markers win.
  if (leftStatus === "conflicted" || rightStatus === "conflicted") return true;
  const leftVal = left.attributes?.value;
  const rightVal = right.attributes?.value;
  if (leftVal != null && rightVal != null && leftVal !== rightVal) return true;
  return false;
}

function resolveGroupStatus(candidates: IdentityCandidate[]): IdentityMatchStatus {
  if (candidates.length === 0) return "unresolved";
  if (candidates.length === 1) {
    const only = candidates[0]!;
    if (isLlmOnlyEvidence(only.evidence)) return "probable";
    if (only.fact.status === "verified" || only.fact.status === "detected") return "confirmed";
    if (only.fact.status === "observed") return "confirmed";
    if (only.fact.status === "conflicted") return "conflicted";
    return "probable";
  }

  for (let i = 0; i < candidates.length; i += 1) {
    for (let j = i + 1; j < candidates.length; j += 1) {
      if (claimsConflict(candidates[i]!.fact, candidates[j]!.fact)) return "conflicted";
    }
  }

  const hasAuthoritative = candidates.some((candidate) =>
    candidate.evidence.some((item) => isAuthoritativeEvidence(item)),
  );
  const allLlm = candidates.every((candidate) => isLlmOnlyEvidence(candidate.evidence));
  if (allLlm) return "probable";
  if (hasAuthoritative) return "confirmed";
  return "probable";
}

function preferCanonicalFact(candidates: IdentityCandidate[]): ScanFact {
  const ranked = [...candidates].sort((left, right) => {
    const leftAuth = left.evidence.some((item) => isAuthoritativeEvidence(item)) ? 1 : 0;
    const rightAuth = right.evidence.some((item) => isAuthoritativeEvidence(item)) ? 1 : 0;
    if (leftAuth !== rightAuth) return rightAuth - leftAuth;
    // LLM-only never wins over deterministic.
    const leftLlm = isLlmOnlyEvidence(left.evidence) ? 1 : 0;
    const rightLlm = isLlmOnlyEvidence(right.evidence) ? 1 : 0;
    if (leftLlm !== rightLlm) return leftLlm - rightLlm;
    return left.fact.id.localeCompare(right.fact.id);
  });
  return ranked[0]!.fact;
}

/**
 * Fuse facts/evidence with conservative identity matching.
 * Conflicts stay first-class; LLM cannot override deterministic evidence.
 */
export function fuseEvidenceAndIdentities(input: FuseEvidenceInput): EvidenceFusionResult {
  const evidenceById = new Map(input.evidence.map((item) => [item.id, item]));
  const groups = new Map<
    string,
    { ruleId: IdentityMatchRuleId; candidates: IdentityCandidate[] }
  >();

  for (const fact of input.facts) {
    const { ruleId, key } = groupKey(fact);
    const current = groups.get(key) ?? { ruleId, candidates: [] };
    current.candidates.push({ fact, evidence: evidenceForFact(fact, evidenceById) });
    groups.set(key, current);
  }

  const fusedFacts: ScanFact[] = [];
  const fusedEvidence: ScanEvidence[] = [];
  const seenEvidence = new Set<string>();
  const matches: IdentityMatchRecord[] = [];

  const sortedKeys = [...groups.keys()].sort((left, right) => left.localeCompare(right));
  for (const key of sortedKeys) {
    const group = groups.get(key)!;
    const status = resolveGroupStatus(group.candidates);
    const canonical = preferCanonicalFact(group.candidates);
    const allFactIds = group.candidates
      .map((item) => item.fact.id)
      .sort((a, b) => a.localeCompare(b));
    const allEvidenceIds = [
      ...new Set(group.candidates.flatMap((item) => item.fact.evidenceIds)),
    ].sort((a, b) => a.localeCompare(b));

    let subjectId = canonical.subjectId;
    if (input.defaultApplicationId && !subjectId.includes("::")) {
      subjectId = scopedSubjectId(input.defaultApplicationId, subjectId);
    }

    const knowledge = dominantKnowledgeStatus(
      status === "conflicted" ? ["conflicted"] : group.candidates.map((item) => item.fact.status),
    );

    const fused: ScanFact = {
      ...canonical,
      id: `fused:${key}`,
      subjectId,
      status: knowledge,
      evidenceIds: allEvidenceIds,
      attributes: {
        ...(canonical.attributes ?? {}),
        fusionRule: group.ruleId,
        fusionStatus: status,
        sourceFactIds: allFactIds.join(","),
      },
    };
    fusedFacts.push(fused);

    for (const evidenceId of allEvidenceIds) {
      const evidence = evidenceById.get(evidenceId);
      if (!evidence || seenEvidence.has(evidence.id)) continue;
      seenEvidence.add(evidence.id);
      fusedEvidence.push(evidence);
    }

    matches.push({
      id: `match:${key}`,
      status,
      ruleId: group.ruleId,
      subjectId,
      objectId: fused.objectId,
      factIds: allFactIds,
      evidenceIds: allEvidenceIds,
      rationale:
        status === "conflicted"
          ? `Conflicting claims under rule ${group.ruleId}; kept conflicted.`
          : `Merged ${allFactIds.length} fact(s) via ${group.ruleId} as ${status}.`,
    });
  }

  fusedFacts.sort((left, right) => left.id.localeCompare(right.id));
  matches.sort((left, right) => left.id.localeCompare(right.id));
  fusedEvidence.sort((left, right) => left.id.localeCompare(right.id));

  return { facts: fusedFacts, evidence: fusedEvidence, matches };
}
