/**
 * PU-03 interpretation tests — ambiguous-only merge, authoritative lock, UNAVAILABLE.
 * Location: shared/product-understanding/interpretation.test.ts
 */

import { describe, expect, it } from "vitest";
import type { ProductUnderstandingModel } from "../product-understanding.types.js";
import { emptyProductUnderstandingModel } from "./index.js";
import {
  buildProductUnderstandingInterpreterInput,
  mergeProductUnderstandingInterpretations,
  PRODUCT_UNDERSTANDING_INTERPRETER_PROMPT_VERSION,
  type ProductUnderstandingInterpreterPort,
} from "./interpretation.js";
import {
  isProductUnderstandingInterpreterEnabled,
  runProductUnderstandingInterpretation,
} from "./run-interpretation.js";

function baseModel(): ProductUnderstandingModel {
  const model = emptyProductUnderstandingModel("demo", "2026-10-06T00:00:00.000Z");
  return {
    ...model,
    concepts: [
      {
        id: "pu:capability:billing",
        kind: "capability",
        label: "Billing",
        knowledgeStatus: "VERIFIED",
        confidence: 0.95,
        evidence: [{ source: "software-graph", refId: "n1" }],
      },
      {
        id: "pu:product-area:mystery",
        kind: "product-area",
        label: "Mystery",
        knowledgeStatus: "UNKNOWN",
        confidence: 0.1,
        evidence: [{ source: "scan", refId: "f1", summary: "weak label" }],
      },
    ],
  };
}

describe("product understanding interpretation", () => {
  it("keeps deterministic model byte-stable when interpreter is off", async () => {
    expect(isProductUnderstandingInterpreterEnabled({})).toBe(false);
    const model = baseModel();
    const result = await runProductUnderstandingInterpretation({ model, env: {} });
    expect(result.interpretation.status).toBe("skipped");
    expect(result.model).toEqual(model);
  });

  it("reports UNAVAILABLE without mutating model when provider missing/errors", async () => {
    const model = baseModel();
    const failing: ProductUnderstandingInterpreterPort = {
      async interpret() {
        throw new Error("provider offline");
      },
    };
    const result = await runProductUnderstandingInterpretation({
      model,
      env: { VISUDEV_PRODUCT_UNDERSTANDING_INTERPRETER: "optional" },
      provider: failing,
    });
    expect(result.interpretation.status).toBe("unavailable");
    expect(result.model).toEqual(model);
  });

  it("never overwrites VERIFIED/SUPPORTED concepts and only applies INTERPRETED/CONFLICTED", () => {
    const merged = mergeProductUnderstandingInterpretations(baseModel(), {
      status: "ok",
      coverage: "PARTIAL",
      annotations: [
        {
          conceptId: "pu:capability:billing",
          label: "Hacked",
          confidence: 0.99,
          provenance: {
            originKind: "llm",
            knowledgeStatus: "INTERPRETED",
            modelId: "m1",
            promptVersion: PRODUCT_UNDERSTANDING_INTERPRETER_PROMPT_VERSION,
            evidence: [{ source: "scan", refId: "llm-1" }],
          },
        },
        {
          conceptId: "pu:product-area:mystery",
          label: "Billing Ops",
          summary: "Likely billing operations area",
          confidence: 0.42,
          provenance: {
            originKind: "llm",
            knowledgeStatus: "INTERPRETED",
            modelId: "m1",
            promptVersion: PRODUCT_UNDERSTANDING_INTERPRETER_PROMPT_VERSION,
            evidence: [{ source: "scan", refId: "llm-2", summary: "name heuristic" }],
          },
        },
        {
          conceptId: "pu:unknown:does-not-exist",
          label: "Ghost",
          confidence: 0.5,
          provenance: {
            originKind: "llm",
            knowledgeStatus: "INTERPRETED",
            modelId: "m1",
            promptVersion: PRODUCT_UNDERSTANDING_INTERPRETER_PROMPT_VERSION,
            evidence: [{ source: "scan", refId: "llm-3" }],
          },
        },
      ],
    });

    expect(merged.concepts.find((c) => c.id === "pu:capability:billing")?.label).toBe("Billing");
    expect(merged.concepts.find((c) => c.id === "pu:capability:billing")?.knowledgeStatus).toBe(
      "VERIFIED",
    );
    const mystery = merged.concepts.find((c) => c.id === "pu:product-area:mystery");
    expect(mystery?.label).toBe("Billing Ops");
    expect(mystery?.knowledgeStatus).toBe("INTERPRETED");
    expect(mystery?.evidence.some((e) => e.refId === "llm-2")).toBe(true);
    expect(merged.concepts.some((c) => c.id === "pu:unknown:does-not-exist")).toBe(false);
  });

  it("builds redacted interpreter input only from ambiguous concepts", () => {
    const input = buildProductUnderstandingInterpreterInput(baseModel());
    expect(input.ambiguousConceptIds).toEqual(["pu:product-area:mystery"]);
    expect(input.redactedEvidence.every((item) => item.text.length <= 160)).toBe(true);
    expect(input.redactedEvidence.some((item) => /secret|token|password/i.test(item.text))).toBe(
      false,
    );
  });
});
