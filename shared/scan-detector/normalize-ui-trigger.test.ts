/**
 * PU-06: trigger normalization + AppFlow projection honesty.
 */
import { describe, expect, it } from "vitest";
import { normalizeUiTrigger } from "./application/normalize-ui-trigger.js";
import { projectUiGraphToAppflow } from "./application/project-ui-graph-to-appflow.js";
import type { UiInteractionGraph } from "../ui-interaction-graph.types.js";

describe("normalizeUiTrigger", () => {
  it("keeps plain labels and marks empty as unknown", () => {
    expect(normalizeUiTrigger({ label: "Speichern" }).displayLabel).toBe("Speichern");
    expect(normalizeUiTrigger({}).isUnknown).toBe(true);
    expect(normalizeUiTrigger({ label: "api_key=supersecret" }).displayLabel).toBe("[redacted]");
  });
});

describe("projectUiGraphToAppflow trigger honesty", () => {
  it("marks open-surface without trigger as unknown and keeps parent-bound modal", () => {
    const graph: UiInteractionGraph = {
      version: 1,
      projectId: "demo",
      analyzedAt: "2026-10-06T00:00:00.000Z",
      surfaces: [
        {
          id: "ui:surface:home",
          kind: "page",
          label: "Home",
          path: "/",
          status: "detected",
          confidence: 0.9,
          evidenceIds: [],
          attributes: { legacyScreenId: "home" },
        },
        {
          id: "ui:surface:modal",
          kind: "modal",
          label: "Create",
          path: "/",
          parentSurfaceId: "ui:surface:home",
          stateKey: "modal:create",
          status: "inferred",
          confidence: 0.7,
          evidenceIds: [],
          attributes: { legacyScreenId: "create-modal" },
        },
      ],
      transitions: [
        {
          id: "tr1",
          kind: "open-surface",
          fromSurfaceId: "ui:surface:home",
          toSurfaceId: "ui:surface:modal",
          status: "inferred",
          confidence: 0.6,
          evidenceIds: [],
        },
        {
          id: "tr2",
          kind: "open-surface",
          fromSurfaceId: "ui:surface:home",
          toSurfaceId: "ui:surface:modal",
          trigger: { label: "Neu anlegen" },
          status: "detected",
          confidence: 0.8,
          evidenceIds: [],
        },
      ],
      evidence: [],
      stats: {
        surfaceCount: 2,
        transitionCount: 2,
        routeSurfaceCount: 1,
        stateSurfaceCount: 1,
        conflictCount: 0,
        runtimeOnlyCount: 0,
      },
    };
    const model = projectUiGraphToAppflow(graph);
    const modal = model.screens.find((s) => s.id === "create-modal");
    expect(modal?.type).toBe("modal");
    expect(modal?.parentScreenId).toBe("home");
    const unknownEdge = model.edges.find((e) => e.triggerUnknown);
    expect(unknownEdge?.status).toBe("unknown");
    expect(unknownEdge?.triggerDisplay).toBe("unknown");
    const labeled = model.edges.find((e) => e.trigger?.label === "Neu anlegen");
    expect(labeled?.triggerUnknown).toBe(false);
    expect(labeled?.status).toBe("detected");
  });
});
