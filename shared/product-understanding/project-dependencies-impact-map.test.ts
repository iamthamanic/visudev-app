/**
 * PU-09: Dependencies impact-map projection tests.
 */
import { describe, expect, it } from "vitest";
import type { ProductUnderstandingModel } from "../product-understanding.types.js";
import { PRODUCT_UNDERSTANDING_MODEL_VERSION } from "../product-understanding.types.js";
import { projectDependenciesImpactMap } from "./project-dependencies-impact-map.js";

function sampleModel(): ProductUnderstandingModel {
  return {
    version: PRODUCT_UNDERSTANDING_MODEL_VERSION,
    projectId: "demo",
    analyzedAt: "2026-10-06T00:00:00.000Z",
    concepts: [
      {
        id: "pu:product-area:leave",
        kind: "product-area",
        label: "Leave",
        summary: "Urlaub",
        knowledgeStatus: "SUPPORTED",
        confidence: 0.8,
        evidence: [{ source: "software-graph", refId: "n:leave" }],
      },
      {
        id: "pu:capability:request",
        kind: "capability",
        label: "Urlaub beantragen",
        knowledgeStatus: "SUPPORTED",
        confidence: 0.7,
        evidence: [{ source: "software-graph", refId: "n:req" }],
      },
      {
        id: "pu:capability:payroll",
        kind: "capability",
        label: "Payroll sync",
        knowledgeStatus: "SUPPORTED",
        confidence: 0.6,
        evidence: [{ source: "software-graph", refId: "n:pay" }],
      },
      {
        id: "pu:capability:mystery",
        kind: "capability",
        label: "Mystery",
        knowledgeStatus: "UNKNOWN",
        confidence: 0.1,
        evidence: [],
      },
      {
        id: "pu:product-area:config",
        kind: "product-area",
        label: "config",
        knowledgeStatus: "SUPPORTED",
        confidence: 0.9,
        evidence: [{ source: "software-graph", refId: "n:cfg" }],
      },
    ],
    relations: [
      {
        id: "rel:uses",
        kind: "uses",
        sourceConceptId: "pu:product-area:leave",
        targetConceptId: "pu:capability:request",
        knowledgeStatus: "SUPPORTED",
        confidence: 0.8,
        evidence: [{ source: "semantic-system-model", refId: "e1" }],
      },
      {
        id: "rel:impacts",
        kind: "impacts",
        sourceConceptId: "pu:capability:request",
        targetConceptId: "pu:capability:payroll",
        knowledgeStatus: "SUPPORTED",
        confidence: 0.7,
        evidence: [{ source: "semantic-system-model", refId: "e2" }],
      },
      {
        id: "rel:unknown",
        kind: "uses",
        sourceConceptId: "pu:product-area:leave",
        targetConceptId: "pu:capability:mystery",
        knowledgeStatus: "UNKNOWN",
        confidence: 0.2,
        evidence: [],
      },
    ],
    impacts: [
      {
        id: "imp:1",
        fromConceptId: "pu:capability:request",
        toConceptId: "pu:capability:payroll",
        summary: "Freigaben können Lohnberechnung verzögern.",
        knowledgeStatus: "INTERPRETED",
        evidence: [{ source: "data-lineage", refId: "dl:1" }],
      },
    ],
    stories: [],
    dataMeanings: [],
    explanations: [],
  };
}

describe("projectDependenciesImpactMap", () => {
  it("projects direct vs transitive impact and never confirms UNKNOWN", () => {
    const projection = projectDependenciesImpactMap(sampleModel(), {
      focusConceptId: "pu:product-area:leave",
    });
    expect(projection.nodes.some((node) => node.label === "config")).toBe(false);
    expect(projection.focusConceptId).toBe("pu:product-area:leave");
    const direct = projection.relations.filter((relation) => relation.hop === "direct");
    const transitive = projection.relations.filter((relation) => relation.hop === "transitive");
    expect(direct.length).toBeGreaterThan(0);
    expect(
      transitive.some((relation) => relation.targetConceptId === "pu:capability:payroll"),
    ).toBe(true);
    const unknown = projection.relations.find(
      (relation) => relation.targetConceptId === "pu:capability:mystery",
    );
    expect(unknown?.confirmed).toBe(false);
    expect(unknown?.whyItMatters).toMatch(/unbekannt|nicht bestätigt/i);
    expect(projection.edges.every((edge) => typeof edge.label === "string")).toBe(true);
    expect(projection.edges.some((edge) => edge.label?.startsWith("direkt:"))).toBe(true);
    expect(projection.edges.some((edge) => edge.label?.startsWith("indirekt:"))).toBe(true);
  });

  it("marks overview as partial when relations are thin or unconfirmed", () => {
    const projection = projectDependenciesImpactMap(sampleModel());
    expect(projection.partial).toBe(true);
    expect(projection.partialReason).toBeTruthy();
  });
});
