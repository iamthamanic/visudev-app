/**
 * Unit tests for PU-15 cross-view selection helpers.
 * Location: shared/product-understanding/cross-view-selection.test.ts
 */

import { describe, expect, it } from "vitest";
import type { ProductUnderstandingModel } from "../product-understanding.types.js";
import { emptyProductUnderstandingModel } from "./index.js";
import {
  CONCEPT_NOT_IN_VIEW_MESSAGE_DE,
  conceptIdFromExecutionStoryId,
  executionStoryIdForConcept,
  listEvidenceNavigationTargets,
  pickPreferredGraphNodeId,
  resolveCrossViewFocus,
} from "./cross-view-selection.js";
import { createProductConceptSelection } from "./selection.js";

function sampleModel(): ProductUnderstandingModel {
  const base = emptyProductUnderstandingModel("demo", "2026-10-06T00:00:00.000Z");
  return {
    ...base,
    concepts: [
      {
        id: "pu:capability:billing",
        kind: "capability",
        label: "Billing",
        knowledgeStatus: "SUPPORTED",
        confidence: 0.8,
        evidence: [
          { source: "software-graph", refId: "n1", summary: "BillingService" },
          { source: "data-lineage", refId: "tbl:invoices", summary: "Invoices" },
          { source: "ui-interaction-graph", refId: "screen:billing", summary: "Billing UI" },
        ],
      },
      {
        id: "pu:external-system:stripe",
        kind: "external-system",
        label: "Stripe",
        knowledgeStatus: "INTERPRETED",
        confidence: 0.4,
        evidence: [
          { source: "software-graph", refId: "n2" },
          { source: "software-graph", refId: "n3" },
        ],
      },
    ],
  };
}

describe("cross-view-selection", () => {
  it("keeps selection when concept is missing and never substitutes", () => {
    const selection = createProductConceptSelection("pu:capability:billing", null, "atlas")!;
    const result = resolveCrossViewFocus(selection, "infrastructure", ["pu:capability:other"]);
    expect(result.presentInView).toBe(false);
    expect(result.viewLocalId).toBeNull();
    expect(result.selection.conceptId).toBe("pu:capability:billing");
    expect(result.messageDe).toBe(CONCEPT_NOT_IN_VIEW_MESSAGE_DE);
  });

  it("marks diagnostics as never present for product concepts", () => {
    const selection = createProductConceptSelection("pu:capability:billing")!;
    const result = resolveCrossViewFocus(selection, "diagnostics", ["pu:capability:billing"]);
    expect(result.presentInView).toBe(false);
    expect(result.messageDe).toBe(CONCEPT_NOT_IN_VIEW_MESSAGE_DE);
  });

  it("maps execution story ids for user-action concepts when available", () => {
    const selection = createProductConceptSelection("pu:user-action:submit-leave")!;
    const storyId = executionStoryIdForConcept(selection.conceptId);
    expect(conceptIdFromExecutionStoryId(storyId)).toBe(selection.conceptId);
    const result = resolveCrossViewFocus(selection, "execution", [storyId]);
    expect(result.presentInView).toBe(true);
    expect(result.viewLocalId).toBe(storyId);
  });

  it("lists evidence-backed navigation targets without inventing joins", () => {
    const targets = listEvidenceNavigationTargets(sampleModel(), "pu:capability:billing");
    expect(targets.map((item) => item.surface).sort()).toEqual(["appflow", "code", "data"]);
  });

  it("picks a single graph evidence target or requires explicit evidenceRefId", () => {
    const model = sampleModel();
    const billing = createProductConceptSelection("pu:capability:billing")!;
    expect(pickPreferredGraphNodeId(model, billing, null)).toBe("n1");

    const stripe = createProductConceptSelection("pu:external-system:stripe")!;
    expect(pickPreferredGraphNodeId(model, stripe, null)).toBeNull();
    const withEvidence = createProductConceptSelection("pu:external-system:stripe", "n3")!;
    expect(pickPreferredGraphNodeId(model, withEvidence, null)).toBe("n3");
    expect(pickPreferredGraphNodeId(model, stripe, new Set(["n2"]))).toBe("n2");
  });
});
