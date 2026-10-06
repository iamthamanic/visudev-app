/**
 * PU-04 explanation + selection contract tests.
 * Location: shared/product-understanding/explanation-selection.test.ts
 */

import { describe, expect, it } from "vitest";
import type { ProductUnderstandingModel } from "../product-understanding.types.js";
import { presentProductConceptExplanation } from "./explanation-presenter.js";
import { emptyProductUnderstandingModel } from "./index.js";
import { buildProductConceptInspectorSections } from "./inspector-sections.js";
import {
  createProductConceptSelection,
  parseProductConceptSelection,
  productConceptSelectionFromSearchParams,
  productConceptSelectionToSearchParams,
  resolveProductConceptSelectionForView,
  serializeProductConceptSelection,
} from "./selection.js";

function sampleModel(): ProductUnderstandingModel {
  const base = emptyProductUnderstandingModel("demo", "2026-10-06T00:00:00.000Z");
  return {
    ...base,
    concepts: [
      {
        id: "pu:capability:billing",
        kind: "capability",
        label: "Billing",
        summary: "Rechnungen verwalten",
        knowledgeStatus: "SUPPORTED",
        confidence: 0.8,
        evidence: [{ source: "software-graph", refId: "n1", summary: "BillingService" }],
      },
      {
        id: "pu:product-area:mystery",
        kind: "product-area",
        label: "Mystery",
        knowledgeStatus: "UNKNOWN",
        confidence: 0.1,
        evidence: [],
      },
      {
        id: "pu:external-system:stripe",
        kind: "external-system",
        label: "Stripe",
        knowledgeStatus: "INTERPRETED",
        confidence: 0.4,
        evidence: [{ source: "scan", refId: "f-stripe" }],
      },
    ],
    relations: [
      {
        id: "rel:1",
        kind: "uses",
        sourceConceptId: "pu:capability:billing",
        targetConceptId: "pu:external-system:stripe",
        knowledgeStatus: "INTERPRETED",
        confidence: 0.4,
        evidence: [{ source: "scan", refId: "e1" }],
      },
    ],
    impacts: [
      {
        id: "imp:1",
        fromConceptId: "pu:capability:billing",
        toConceptId: "pu:external-system:stripe",
        summary: "Zahlungsanbieter-Wechsel betrifft Billing.",
        knowledgeStatus: "SUPPORTED",
        evidence: [{ source: "software-graph", refId: "n1" }],
      },
    ],
  };
}

describe("product understanding explanation + selection", () => {
  it("presents Level 1/2/3 and does not mark UNKNOWN as confirmed", () => {
    const model = sampleModel();
    const billing = presentProductConceptExplanation(model, "pu:capability:billing");
    expect(billing).toBeTruthy();
    expect(billing!.level1.title).toBe("Was ist das?");
    expect(billing!.level2.title).toBe("Wie hängt es zusammen?");
    expect(billing!.level3.title).toBe("Technische Evidence");
    expect(billing!.isConfirmed).toBe(true);
    expect(billing!.level3.evidence.length).toBeGreaterThan(0);

    const mystery = presentProductConceptExplanation(model, "pu:product-area:mystery");
    expect(mystery).toBeTruthy();
    expect(mystery!.isConfirmed).toBe(false);
    expect(mystery!.statusLabel.toLowerCase()).toContain("ungeklärt");
    expect(mystery!.level1.body.toLowerCase()).not.toContain("bestätigt als");
    expect(mystery!.level1.body).toMatch(/nicht bestätigt|Ungeklärt|ungeklärt/i);

    const external = presentProductConceptExplanation(model, "pu:external-system:stripe");
    expect(external!.isConfirmed).toBe(false);
    expect(external!.statusLabel).toMatch(/Interpretiert/);
  });

  it("builds shared inspector sections without view-local formatting", () => {
    const view = presentProductConceptExplanation(sampleModel(), "pu:capability:billing");
    const sections = buildProductConceptInspectorSections(view!);
    expect(sections.map((section) => section.id)).toEqual([
      "purpose",
      "why-it-matters",
      "system",
      "impact",
      "status",
      "evidence",
    ]);
    expect(sections.every((section) => section.body.length > 0)).toBe(true);
  });

  it("serializes ProductConcept selection for URL/query without view-specific IDs", () => {
    const selection = createProductConceptSelection("pu:capability:billing", "n1", "architecture");
    expect(selection).toBeTruthy();
    const token = serializeProductConceptSelection(selection!);
    expect(parseProductConceptSelection(token)).toEqual(selection);

    const params = productConceptSelectionToSearchParams(selection!);
    expect(params.get("puConcept")).toBe("pu:capability:billing");
    expect(params.get("puEvidence")).toBe("n1");
    expect(productConceptSelectionFromSearchParams(params)).toEqual(selection);

    const missing = resolveProductConceptSelectionForView(selection!, ["pu:product-area:other"]);
    expect(missing.presentInView).toBe(false);
    expect(missing.selection.conceptId).toBe("pu:capability:billing");
  });

  it("rejects non-product concept ids", () => {
    expect(createProductConceptSelection("node:billing")).toBeNull();
    expect(parseProductConceptSelection("graph:xyz")).toBeNull();
  });
});
