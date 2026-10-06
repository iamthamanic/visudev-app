/**
 * PU-08: Architecture responsibility projection tests.
 */
import { describe, expect, it } from "vitest";
import type { ProductUnderstandingModel } from "../product-understanding.types.js";
import { PRODUCT_UNDERSTANDING_MODEL_VERSION } from "../product-understanding.types.js";
import { projectArchitectureResponsibilities } from "./project-architecture-responsibilities.js";

function sampleModel(): ProductUnderstandingModel {
  return {
    version: PRODUCT_UNDERSTANDING_MODEL_VERSION,
    projectId: "demo",
    analyzedAt: "2026-10-06T00:00:00.000Z",
    concepts: [
      {
        id: "pu:application:app",
        kind: "application",
        label: "HR Tool",
        summary: "Personalverwaltung.",
        knowledgeStatus: "SUPPORTED",
        confidence: 0.9,
        evidence: [{ source: "software-graph", refId: "app:hr" }],
      },
      {
        id: "pu:product-area:leave",
        kind: "product-area",
        label: "Leave",
        summary: "Urlaubsanträge und Freigaben.",
        knowledgeStatus: "SUPPORTED",
        confidence: 0.8,
        evidence: [{ source: "semantic-system-model", refId: "sem:leave" }],
        technicalRefs: [{ source: "software-graph", refId: "module:leave-repo" }],
      },
      {
        id: "pu:capability:request-leave",
        kind: "capability",
        label: "Urlaub beantragen",
        knowledgeStatus: "SUPPORTED",
        confidence: 0.7,
        evidence: [
          { source: "software-graph", refId: "module:leave-uc" },
          { source: "software-graph", refId: "module:leave-repo" },
          { source: "software-graph", refId: "route:leave" },
        ],
        technicalRefs: [
          { source: "software-graph", refId: "module:leave-uc" },
          { source: "software-graph", refId: "module:leave-repo" },
          { source: "software-graph", refId: "route:leave" },
        ],
      },
      {
        id: "pu:capability:orphan",
        kind: "capability",
        label: "Orphan Cap",
        knowledgeStatus: "INTERPRETED",
        confidence: 0.3,
        evidence: [{ source: "semantic-system-model", refId: "sem:orphan" }],
      },
      {
        id: "pu:product-area:config",
        kind: "product-area",
        label: "config",
        knowledgeStatus: "SUPPORTED",
        confidence: 0.9,
        evidence: [{ source: "software-graph", refId: "n:config" }],
      },
    ],
    relations: [
      {
        id: "rel:1",
        kind: "contains",
        sourceConceptId: "pu:application:app",
        targetConceptId: "pu:product-area:leave",
        knowledgeStatus: "SUPPORTED",
        confidence: 0.8,
        evidence: [{ source: "semantic-system-model", refId: "rel:1" }],
      },
      {
        id: "rel:2",
        kind: "contains",
        sourceConceptId: "pu:product-area:leave",
        targetConceptId: "pu:capability:request-leave",
        knowledgeStatus: "SUPPORTED",
        confidence: 0.7,
        evidence: [{ source: "semantic-system-model", refId: "rel:2" }],
      },
    ],
    impacts: [],
    stories: [],
    dataMeanings: [],
    explanations: [],
  };
}

describe("projectArchitectureResponsibilities", () => {
  it("projects responsibility cards with distributed and unclear boundaries", () => {
    const projection = projectArchitectureResponsibilities(sampleModel());
    expect(projection.cards.some((card) => card.label === "config")).toBe(false);
    expect(projection.primaryAreaIds).toContain("pu:product-area:leave");
    const leaveCap = projection.cards.find((card) => card.id === "pu:capability:request-leave");
    expect(leaveCap?.boundary).toBe("distributed");
    expect(leaveCap?.boundaryLabel).toBe("Verantwortung verteilt");
    const orphan = projection.cards.find((card) => card.id === "pu:capability:orphan");
    expect(orphan?.boundary).toBe("unclear");
    expect(projection.partial).toBe(true);
    expect(projection.partialReason).toBeTruthy();
  });
});
