/**
 * Canonical Product Readiness epistemic contracts (#376 / PR-02).
 * KnowledgeStatus, CoverageStatus, DetectionState + legacy snapshot mappings.
 * Location: shared/scan-detector/epistemic.ts
 */

/** Canonical knowledge status (Epic #374). Do not introduce INFERRED as product semantics. */
export type KnowledgeStatus = "VERIFIED" | "SUPPORTED" | "INTERPRETED" | "UNKNOWN" | "CONFLICTED";

/** Capability-level completeness. */
export type CoverageStatus = "COMPLETE" | "PARTIAL" | "UNAVAILABLE";

/**
 * Empty/missing detection honesty — empty graph ≠ ABSENT.
 * Distinguishes true absence from failed/unsupported detection.
 */
export type DetectionState = "ABSENT" | "NOT_DETECTED" | "UNSUPPORTED" | "UNKNOWN" | "CONFLICTED";

/** Legacy SDE-02 statuses persisted in older ScanSnapshots. */
export type LegacyScanKnowledgeStatus =
  | "detected"
  | "inferred"
  | "observed"
  | "verified"
  | "conflicted"
  | "unknown";

const KNOWLEDGE_STATUSES: readonly KnowledgeStatus[] = [
  "VERIFIED",
  "SUPPORTED",
  "INTERPRETED",
  "UNKNOWN",
  "CONFLICTED",
] as const;

const COVERAGE_STATUSES: readonly CoverageStatus[] = [
  "COMPLETE",
  "PARTIAL",
  "UNAVAILABLE",
] as const;

const DETECTION_STATES: readonly DetectionState[] = [
  "ABSENT",
  "NOT_DETECTED",
  "UNSUPPORTED",
  "UNKNOWN",
  "CONFLICTED",
] as const;

const LEGACY_TO_KNOWLEDGE: Record<LegacyScanKnowledgeStatus, KnowledgeStatus> = {
  verified: "VERIFIED",
  // Engine/static detection without runtime verify → supported claim
  detected: "SUPPORTED",
  // Runtime observation without stronger verify → supported
  observed: "SUPPORTED",
  inferred: "INTERPRETED",
  conflicted: "CONFLICTED",
  unknown: "UNKNOWN",
};

const KNOWLEDGE_TO_LEGACY: Record<KnowledgeStatus, LegacyScanKnowledgeStatus> = {
  VERIFIED: "verified",
  SUPPORTED: "detected",
  INTERPRETED: "inferred",
  UNKNOWN: "unknown",
  CONFLICTED: "conflicted",
};

export function isKnowledgeStatus(value: unknown): value is KnowledgeStatus {
  return typeof value === "string" && (KNOWLEDGE_STATUSES as readonly string[]).includes(value);
}

export function isCoverageStatus(value: unknown): value is CoverageStatus {
  return typeof value === "string" && (COVERAGE_STATUSES as readonly string[]).includes(value);
}

export function isDetectionState(value: unknown): value is DetectionState {
  return typeof value === "string" && (DETECTION_STATES as readonly string[]).includes(value);
}

export function isLegacyScanKnowledgeStatus(value: unknown): value is LegacyScanKnowledgeStatus {
  return (
    value === "detected" ||
    value === "inferred" ||
    value === "observed" ||
    value === "verified" ||
    value === "conflicted" ||
    value === "unknown"
  );
}

/**
 * Deterministic read of legacy or canonical status from snapshots / facts.
 * Unknown strings → UNKNOWN (never invent VERIFIED).
 */
export function coerceKnowledgeStatus(value: unknown): KnowledgeStatus {
  if (isKnowledgeStatus(value)) return value;
  if (isLegacyScanKnowledgeStatus(value)) return LEGACY_TO_KNOWLEDGE[value];
  if (typeof value === "string") {
    const upper = value.trim().toUpperCase();
    if (isKnowledgeStatus(upper)) return upper;
  }
  return "UNKNOWN";
}

/** Emit legacy wire status for older consumers (lossy for observed→detected path). */
export function toLegacyScanKnowledgeStatus(status: KnowledgeStatus): LegacyScanKnowledgeStatus {
  return KNOWLEDGE_TO_LEGACY[status];
}

export type EpistemicOriginKind =
  | "static"
  | "runtime"
  | "data"
  | "heuristic"
  | "llm"
  | "user"
  | "merged";

/**
 * Apply origin policy: LLM origin may only yield INTERPRETED.
 * Never elevates LLM claims to VERIFIED/SUPPORTED.
 */
export function applyOriginKnowledgePolicy(
  status: KnowledgeStatus | LegacyScanKnowledgeStatus | string,
  originKind: EpistemicOriginKind | string,
  options?: { llmSuggested?: boolean },
): KnowledgeStatus {
  const canonical = coerceKnowledgeStatus(status);
  const llm = originKind === "llm" || options?.llmSuggested === true;
  if (llm) {
    if (canonical === "CONFLICTED") return "CONFLICTED";
    return "INTERPRETED";
  }
  return canonical;
}

/** Authoritative claims exclude LLM and INTERPRETED/UNKNOWN. */
export function isAuthoritativeKnowledgeStatus(status: KnowledgeStatus): boolean {
  return status === "VERIFIED" || status === "SUPPORTED";
}

/**
 * Dominance for fused identities (highest conflict / verification wins).
 * Order: CONFLICTED > VERIFIED > SUPPORTED > INTERPRETED > UNKNOWN
 */
export function dominantCanonicalKnowledgeStatus(
  statuses: readonly (KnowledgeStatus | LegacyScanKnowledgeStatus | string)[],
): KnowledgeStatus {
  const canonical = statuses.map((status) => coerceKnowledgeStatus(status));
  if (canonical.includes("CONFLICTED")) return "CONFLICTED";
  if (canonical.includes("VERIFIED")) return "VERIFIED";
  if (canonical.includes("SUPPORTED")) return "SUPPORTED";
  if (canonical.includes("INTERPRETED")) return "INTERPRETED";
  return "UNKNOWN";
}

/**
 * Coverage honesty: incomplete analysis (budget/timeout/auth/safety) must not be COMPLETE.
 */
export function resolveCoverageStatus(input: {
  available: boolean;
  complete: boolean;
  limitedBy?: "budget" | "timeout" | "auth-barrier" | "safety-barrier" | "unsupported" | null;
}): CoverageStatus {
  if (!input.available || input.limitedBy === "unsupported") return "UNAVAILABLE";
  if (
    input.limitedBy === "budget" ||
    input.limitedBy === "timeout" ||
    input.limitedBy === "auth-barrier" ||
    input.limitedBy === "safety-barrier"
  ) {
    return "PARTIAL";
  }
  return input.complete ? "COMPLETE" : "PARTIAL";
}

export {
  KNOWLEDGE_STATUSES,
  COVERAGE_STATUSES,
  DETECTION_STATES,
  LEGACY_TO_KNOWLEDGE,
  KNOWLEDGE_TO_LEGACY,
};
