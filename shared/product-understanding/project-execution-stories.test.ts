/**
 * PU-10: Execution stories projection tests.
 */
import { describe, expect, it } from "vitest";
import type { ProductUnderstandingModel } from "../product-understanding.types.js";
import { PRODUCT_UNDERSTANDING_MODEL_VERSION } from "../product-understanding.types.js";
import { projectExecutionStories } from "./project-execution-stories.js";

function sampleModel(): ProductUnderstandingModel {
  return {
    version: PRODUCT_UNDERSTANDING_MODEL_VERSION,
    projectId: "demo",
    analyzedAt: "2026-10-06T00:00:00.000Z",
    concepts: [
      {
        id: "pu:user-action:speichern",
        kind: "user-action",
        label: "Speichern",
        knowledgeStatus: "SUPPORTED",
        confidence: 0.8,
        evidence: [{ source: "ui-interaction-graph", refId: "t:save" }],
      },
      {
        id: "pu:capability:persist",
        kind: "capability",
        label: "Persistenz",
        knowledgeStatus: "SUPPORTED",
        confidence: 0.7,
        evidence: [{ source: "semantic-system-model", refId: "e:persist" }],
      },
      {
        id: "pu:information:leave",
        kind: "information",
        label: "Urlaubsantrag",
        knowledgeStatus: "INTERPRETED",
        confidence: 0.4,
        evidence: [],
      },
    ],
    relations: [
      {
        id: "rel:1",
        kind: "triggers",
        sourceConceptId: "pu:user-action:speichern",
        targetConceptId: "pu:capability:persist",
        knowledgeStatus: "SUPPORTED",
        confidence: 0.7,
        evidence: [{ source: "semantic-system-model", refId: "r1" }],
      },
      {
        id: "rel:2",
        kind: "flows-to",
        sourceConceptId: "pu:user-action:speichern",
        targetConceptId: "pu:information:leave",
        knowledgeStatus: "INTERPRETED",
        confidence: 0.3,
        evidence: [{ source: "data-lineage", refId: "dl1" }],
      },
    ],
    impacts: [],
    stories: [],
    dataMeanings: [],
    explanations: [],
  };
}

describe("projectExecutionStories", () => {
  it("lists user-action stories with plain-language steps and null timings", () => {
    const projection = projectExecutionStories(sampleModel(), {
      version: 1,
      projectId: "demo",
      analyzedAt: "2026-10-06T00:00:00.000Z",
      scopes: [],
      nodes: [
        {
          id: "route:save",
          kind: "route",
          label: "POST /save Speichern",
          metadata: {},
        },
      ],
      edges: [],
      evidence: [],
      groups: [],
      metrics: [],
      condensed: false,
      limits: { maxNodes: 100, maxEdges: 100 },
    });
    expect(projection.stories.length).toBeGreaterThan(0);
    const story = projection.stories[0]!;
    expect(story.title).toBe("Speichern");
    expect(story.steps.some((step) => step.role === "action")).toBe(true);
    expect(story.steps.some((step) => step.role === "outcome")).toBe(true);
    expect(story.steps.every((step) => step.durationMs === null)).toBe(true);
    expect(story.routeId).toBe("route:save");
  });

  it("never confirms outcome without authoritative evidence", () => {
    const projection = projectExecutionStories(sampleModel());
    const outcome = projection.stories[0]?.steps.find((step) => step.role === "outcome");
    expect(outcome?.label).toMatch(/nicht als bestätigt|Ergebnis/i);
  });
});
