/**
 * PU-11: Data information-flow projection tests.
 */
import { describe, expect, it } from "vitest";
import type { ProductUnderstandingModel } from "../product-understanding.types.js";
import { PRODUCT_UNDERSTANDING_MODEL_VERSION } from "../product-understanding.types.js";
import type { DataLineageGraph } from "../data-lineage.types.js";
import { projectDataInformationFlow } from "./project-data-information-flow.js";

function sampleModel(): ProductUnderstandingModel {
  return {
    version: PRODUCT_UNDERSTANDING_MODEL_VERSION,
    projectId: "demo",
    analyzedAt: "2026-10-06T00:00:00.000Z",
    concepts: [
      {
        id: "pu:information:leave-request",
        kind: "information",
        label: "Urlaubsantrag",
        summary: "Antrag auf Freistellung",
        knowledgeStatus: "SUPPORTED",
        confidence: 0.8,
        evidence: [{ source: "data-lineage", refId: "entity:leave" }],
      },
    ],
    relations: [],
    impacts: [],
    stories: [],
    dataMeanings: [],
    explanations: [],
  };
}

function sampleLineage(): DataLineageGraph {
  return {
    version: 1,
    projectId: "demo",
    analyzedAt: "2026-10-06T00:00:00.000Z",
    paths: [
      {
        id: "path:1",
        status: "partial",
        terminalHopIndex: 1,
        truncationReason: "consumer unresolved",
        hops: [
          {
            from: {
              layer: "ui-interaction",
              entityId: "ui:save",
              label: "Speichern",
            },
            to: {
              layer: "service-module",
              entityId: "svc:leave",
              label: "LeaveService",
            },
            joinRuleId: "join:ui-svc",
            knowledgeStatus: "SUPPORTED",
            confidence: 0.7,
            evidence: [
              {
                evidenceId: "ev1",
                sourceIr: "software-graph",
                kind: "call",
                summary: "handler",
              },
            ],
          },
          {
            from: {
              layer: "service-module",
              entityId: "svc:leave",
              label: "LeaveService",
            },
            to: {
              layer: "data-entity",
              entityId: "entity:leave",
              label: "Urlaubsantrag",
            },
            joinRuleId: "join:svc-data",
            knowledgeStatus: "INTERPRETED",
            confidence: 0.4,
            evidence: [],
          },
        ],
      },
    ],
    stats: {
      pathCount: 1,
      completeCount: 0,
      partialCount: 1,
      unresolvedCount: 0,
    },
  };
}

describe("projectDataInformationFlow", () => {
  it("projects information cards with evidence-backed hops and never confirms UNKNOWN", () => {
    const projection = projectDataInformationFlow(sampleModel(), sampleLineage());
    expect(projection.cards).toHaveLength(1);
    const card = projection.cards[0]!;
    expect(card.title).toBe("Urlaubsantrag");
    expect(card.meaning).toMatch(/Freistellung|Urlaubsantrag/);
    expect(card.hops.some((hop) => hop.role === "origin")).toBe(true);
    expect(card.hops.some((hop) => hop.role === "storage")).toBe(true);
    expect(card.hops.some((hop) => hop.role === "storage" && hop.confirmed)).toBe(false);
    expect(card.pathStatus).toBe("partial");
    expect(projection.partial).toBe(true);
  });

  it("marks empty lineage honestly", () => {
    const projection = projectDataInformationFlow(sampleModel(), null);
    expect(projection.cards[0]?.pathStatus).toBe("empty");
    expect(projection.cards[0]?.partialReason).toMatch(/kein belegter lineage/i);
  });
});
