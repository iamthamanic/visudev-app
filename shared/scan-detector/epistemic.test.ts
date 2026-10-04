/**
 * PR-02 epistemic contract tests (#376).
 * Location: shared/scan-detector/epistemic.test.ts
 */

import { describe, expect, it } from "vitest";
import {
  applyOriginKnowledgePolicy,
  coerceKnowledgeStatus,
  isCoverageStatus,
  isDetectionState,
  isKnowledgeStatus,
  KNOWLEDGE_STATUSES,
  resolveCoverageStatus,
  toLegacyScanKnowledgeStatus,
} from "./epistemic.js";
import { isAuthoritativeEvidence, isScanKnowledgeStatus, readKnowledgeStatus } from "./types.js";

describe("KnowledgeStatus contract", () => {
  it("exposes exactly VERIFIED/SUPPORTED/INTERPRETED/UNKNOWN/CONFLICTED", () => {
    expect([...KNOWLEDGE_STATUSES].sort()).toEqual(
      ["CONFLICTED", "INTERPRETED", "SUPPORTED", "UNKNOWN", "VERIFIED"].sort(),
    );
    for (const status of KNOWLEDGE_STATUSES) {
      expect(isKnowledgeStatus(status)).toBe(true);
      expect(isScanKnowledgeStatus(status)).toBe(true);
    }
    expect(isKnowledgeStatus("INFERRED")).toBe(false);
    expect(isKnowledgeStatus("inferred")).toBe(false);
  });

  it("maps legacy snapshot statuses deterministically", () => {
    expect(coerceKnowledgeStatus("verified")).toBe("VERIFIED");
    expect(coerceKnowledgeStatus("detected")).toBe("SUPPORTED");
    expect(coerceKnowledgeStatus("observed")).toBe("SUPPORTED");
    expect(coerceKnowledgeStatus("inferred")).toBe("INTERPRETED");
    expect(coerceKnowledgeStatus("conflicted")).toBe("CONFLICTED");
    expect(coerceKnowledgeStatus("unknown")).toBe("UNKNOWN");
    expect(coerceKnowledgeStatus("VERIFIED")).toBe("VERIFIED");
    expect(toLegacyScanKnowledgeStatus("INTERPRETED")).toBe("inferred");
  });

  it("forces originKind=llm to INTERPRETED (never VERIFIED/SUPPORTED)", () => {
    expect(applyOriginKnowledgePolicy("VERIFIED", "llm")).toBe("INTERPRETED");
    expect(applyOriginKnowledgePolicy("SUPPORTED", "llm")).toBe("INTERPRETED");
    expect(applyOriginKnowledgePolicy("detected", "llm")).toBe("INTERPRETED");
    expect(applyOriginKnowledgePolicy("CONFLICTED", "llm")).toBe("CONFLICTED");
    expect(readKnowledgeStatus("verified", { originKind: "llm", llmSuggested: true })).toBe(
      "INTERPRETED",
    );
    expect(readKnowledgeStatus("detected", { originKind: "static" })).toBe("SUPPORTED");
  });

  it("keeps LLM evidence non-authoritative", () => {
    expect(
      isAuthoritativeEvidence({
        id: "e1",
        kind: "x",
        status: "VERIFIED",
        confidence: 1,
        provenance: { originKind: "llm", detectorId: "llm", llmSuggested: true },
        payload: {},
      }),
    ).toBe(false);
  });
});

describe("CoverageStatus and DetectionState", () => {
  it("defines COMPLETE/PARTIAL/UNAVAILABLE and detection honesty states", () => {
    expect(isCoverageStatus("COMPLETE")).toBe(true);
    expect(isCoverageStatus("PARTIAL")).toBe(true);
    expect(isCoverageStatus("UNAVAILABLE")).toBe(true);
    expect(isCoverageStatus("FULL")).toBe(false);

    for (const state of [
      "ABSENT",
      "NOT_DETECTED",
      "UNSUPPORTED",
      "UNKNOWN",
      "CONFLICTED",
    ] as const) {
      expect(isDetectionState(state)).toBe(true);
    }
  });

  it("never marks budget/timeout barriers as COMPLETE", () => {
    expect(resolveCoverageStatus({ available: true, complete: true, limitedBy: "budget" })).toBe(
      "PARTIAL",
    );
    expect(resolveCoverageStatus({ available: true, complete: true, limitedBy: "timeout" })).toBe(
      "PARTIAL",
    );
    expect(resolveCoverageStatus({ available: false, complete: false })).toBe("UNAVAILABLE");
    expect(resolveCoverageStatus({ available: true, complete: true })).toBe("COMPLETE");
  });
});
