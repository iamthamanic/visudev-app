/**
 * PU-07: Atlas product-domain map projection.
 */
import { describe, expect, it } from "vitest";
import type { ProductUnderstandingModel } from "../product-understanding.types.js";
import { PRODUCT_UNDERSTANDING_MODEL_VERSION } from "../product-understanding.types.js";
import { projectAtlasProductMap } from "./project-atlas-product-map.js";

function sampleModel(): ProductUnderstandingModel {
  return {
    version: PRODUCT_UNDERSTANDING_MODEL_VERSION,
    projectId: "demo",
    analyzedAt: "2026-10-06T00:00:00.000Z",
    concepts: [
      {
        id: "pu:application:app",
        kind: "application",
        label: "Harbor Desk",
        summary: "Koordiniert Hafenoperationen.",
        knowledgeStatus: "SUPPORTED",
        confidence: 0.9,
        evidence: [{ source: "software-graph", refId: "node:app" }],
      },
      {
        id: "pu:product-area:billing",
        kind: "product-area",
        label: "Abrechnung",
        summary: "Rechnungen und Zahlungen.",
        knowledgeStatus: "SUPPORTED",
        confidence: 0.8,
        evidence: [{ source: "semantic-system-model", refId: "sem:billing" }],
        technicalRefs: [{ source: "software-graph", refId: "svc:billing" }],
      },
      {
        id: "pu:capability:invoices",
        kind: "capability",
        label: "Rechnungen",
        knowledgeStatus: "INTERPRETED",
        confidence: 0.6,
        evidence: [{ source: "ui-interaction-graph", refId: "ui:invoices" }],
      },
      {
        id: "pu:system-part:auth-service",
        kind: "system-part",
        label: "AuthService",
        knowledgeStatus: "SUPPORTED",
        confidence: 0.7,
        evidence: [{ source: "software-graph", refId: "svc:auth" }],
      },
    ],
    relations: [
      {
        id: "rel:1",
        kind: "contains",
        sourceConceptId: "pu:product-area:billing",
        targetConceptId: "pu:capability:invoices",
        knowledgeStatus: "SUPPORTED",
        confidence: 0.7,
        evidence: [{ source: "semantic-system-model", refId: "rel:sem" }],
      },
    ],
    impacts: [],
    stories: [],
    dataMeanings: [],
    explanations: [],
  };
}

describe("projectAtlasProductMap", () => {
  it("projects only application/product-area/capability with purpose", () => {
    const projection = projectAtlasProductMap(sampleModel());
    const kinds = new Set(projection.concepts.map((c) => c.kind));
    expect(kinds.has("system-part")).toBe(false);
    expect(kinds.has("application")).toBe(true);
    expect(kinds.has("product-area")).toBe(true);
    expect(kinds.has("capability")).toBe(true);
    expect(
      projection.nodes.every((node) => typeof node.purpose === "string" && node.purpose.length > 0),
    ).toBe(true);
    expect(projection.nodes.some((node) => /AuthService|auth\.ts|route/i.test(node.label))).toBe(
      false,
    );
  });

  it("drops structural folder labels from the Atlas product map", () => {
    const model = sampleModel();
    model.concepts.push({
      id: "pu:product-area:config",
      kind: "product-area",
      label: "config",
      knowledgeStatus: "SUPPORTED",
      confidence: 0.9,
      evidence: [
        { source: "software-graph", refId: "n:config" },
        { source: "semantic-system-model", refId: "sem:config" },
      ],
    });
    const projection = projectAtlasProductMap(model);
    expect(projection.nodes.some((node) => node.label.toLowerCase() === "config")).toBe(false);
    expect(projection.groups.some((group) => group.label.toLowerCase() === "config")).toBe(false);
  });

  it("keeps technical refs off the primary node list but available via adapters", () => {
    const projection = projectAtlasProductMap(sampleModel());
    const billing = projection.semanticEntities.find((e) => e.id === "pu:product-area:billing");
    expect(billing?.metadata.technicalRefs).toContain("svc:billing");
    expect(projection.sourceGraphNodeIdBySemanticId["pu:product-area:billing"]).toBe("svc:billing");
  });
});
