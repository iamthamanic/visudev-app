/**
 * SDE-05 identity fusion + redaction tests.
 */

import { describe, expect, it } from "vitest";
import { redactFactsAndEvidence } from "./domain/evidence/redact.js";
import { fuseEvidenceAndIdentities } from "./domain/identity/fuse-evidence.js";
import type { ScanEvidence, ScanFact } from "./types.js";

function fact(partial: Partial<ScanFact> & Pick<ScanFact, "id" | "subjectId">): ScanFact {
  return {
    kind: "route",
    status: "detected",
    confidence: 1,
    provenance: { originKind: "static", detectorId: "static-routes" },
    evidenceIds: [],
    ...partial,
  };
}

function evidence(
  partial: Partial<ScanEvidence> & Pick<ScanEvidence, "id" | "provenance">,
): ScanEvidence {
  return {
    kind: "ast",
    status: "detected",
    confidence: 1,
    payload: {},
    ...partial,
  };
}

describe("fuseEvidenceAndIdentities", () => {
  it("merges matching semantic keys as confirmed and keeps conflicts", () => {
    const staticFact = fact({
      id: "f-static",
      subjectId: "route:users",
      objectId: "handler:users",
      evidenceIds: ["e-static"],
      attributes: { semanticKey: "GET /api/users", applicationId: "app:web", value: "static" },
    });
    const runtimeFact = fact({
      id: "f-runtime",
      subjectId: "runtime:users",
      objectId: "handler:users",
      status: "observed",
      provenance: { originKind: "runtime", detectorId: "runtime-crawl" },
      evidenceIds: ["e-runtime"],
      attributes: { semanticKey: "GET /api/users", applicationId: "app:web", value: "static" },
    });
    const conflictFact = fact({
      id: "f-conflict",
      subjectId: "route:users-alt",
      objectId: "handler:other",
      evidenceIds: ["e-conflict"],
      attributes: { semanticKey: "GET /api/users", applicationId: "app:web", value: "other" },
    });

    const ev = [
      evidence({
        id: "e-static",
        provenance: { originKind: "static", detectorId: "static-routes" },
      }),
      evidence({
        id: "e-runtime",
        status: "observed",
        provenance: { originKind: "runtime", detectorId: "runtime-crawl" },
      }),
      evidence({
        id: "e-conflict",
        provenance: { originKind: "static", detectorId: "static-routes" },
      }),
    ];

    const merged = fuseEvidenceAndIdentities({
      facts: [staticFact, runtimeFact],
      evidence: ev.slice(0, 2),
    });
    expect(merged.matches).toHaveLength(1);
    expect(merged.matches[0]?.status).toBe("confirmed");
    expect(merged.matches[0]?.ruleId).toBe("semantic-key");
    expect(merged.facts[0]?.evidenceIds.sort()).toEqual(["e-runtime", "e-static"]);

    const conflicted = fuseEvidenceAndIdentities({
      facts: [staticFact, conflictFact],
      evidence: [ev[0]!, ev[2]!],
    });
    expect(conflicted.matches[0]?.status).toBe("conflicted");
    expect(conflicted.facts[0]?.status).toBe("conflicted");
  });

  it("does not let LLM-only evidence override deterministic facts", () => {
    const deterministic = fact({
      id: "f-det",
      subjectId: "route:a",
      evidenceIds: ["e-det"],
      attributes: { semanticKey: "GET /a", value: "det" },
    });
    const llm = fact({
      id: "f-llm",
      subjectId: "route:a-llm",
      status: "inferred",
      provenance: { originKind: "llm", detectorId: "llm", llmSuggested: true },
      evidenceIds: ["e-llm"],
      attributes: { semanticKey: "GET /a", value: "llm" },
    });
    const result = fuseEvidenceAndIdentities({
      facts: [deterministic, llm],
      evidence: [
        evidence({
          id: "e-det",
          provenance: { originKind: "static", detectorId: "static" },
        }),
        evidence({
          id: "e-llm",
          status: "inferred",
          provenance: { originKind: "llm", detectorId: "llm", llmSuggested: true },
        }),
      ],
    });
    expect(result.matches[0]?.status).toBe("conflicted");
    expect(result.facts[0]?.id.startsWith("fused:")).toBe(true);
    // Canonical preference still picks deterministic fact as base.
    expect(result.facts[0]?.provenance.originKind).toBe("static");
  });

  it("is deterministic for identical inputs", () => {
    const facts = [
      fact({
        id: "b",
        subjectId: "s:b",
        attributes: { semanticKey: "K" },
        evidenceIds: [],
      }),
      fact({
        id: "a",
        subjectId: "s:a",
        attributes: { semanticKey: "K" },
        evidenceIds: [],
      }),
    ];
    const first = fuseEvidenceAndIdentities({ facts, evidence: [] });
    const second = fuseEvidenceAndIdentities({ facts, evidence: [] });
    expect(first.matches.map((item) => item.id)).toEqual(second.matches.map((item) => item.id));
    expect(first.facts.map((item) => item.id)).toEqual(second.facts.map((item) => item.id));
  });
});

describe("redactFactsAndEvidence", () => {
  it("redacts secret-like attributes and never keeps tokens in identity attrs", () => {
    const result = redactFactsAndEvidence(
      [
        fact({
          id: "f1",
          subjectId: "s1",
          attributes: { token: "secret-value", semanticKey: "GET /ok" },
        }),
      ],
      [
        evidence({
          id: "e1",
          provenance: { originKind: "static", detectorId: "x" },
          payload: {
            summary: "Authorization: Bearer abcdefghijklmnop",
            attributes: { apiKey: "x" },
          },
        }),
      ],
    );
    expect(result.facts[0]?.attributes?.token).toBe("[redacted]");
    expect(result.evidence[0]?.payload.summary).toBe("[redacted]");
    expect(result.evidence[0]?.payload.attributes?.apiKey).toBe("[redacted]");
  });
});
