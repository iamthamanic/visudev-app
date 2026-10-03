/**
 * Unit tests for SDE-11 AppFlow UIInteractionGraph cutover resolve path.
 */

import { describe, expect, it } from "vitest";
import {
  parseAppflowAnalysisMode,
  DEFAULT_APPFLOW_ANALYSIS_MODE,
} from "./domain/appflow-analysis-mode.js";
import { resolveAppflowAnalysis } from "./application/resolve-appflow-analysis.js";
import { projectUiGraphToAppflow } from "./application/project-ui-graph-to-appflow.js";
import { adaptLegacyScreensToUiGraph } from "./application/adapt-legacy-screens-to-ui-graph.js";
import type { LegacyScreenLike } from "../ui-interaction-graph.types.js";
import type { RuntimeObserverCrawlResult } from "./domain/runtime/crawl-result.js";

const screens: LegacyScreenLike[] = [
  {
    id: "home",
    name: "Home",
    path: "/",
    type: "page",
    navigatesTo: ["about"],
    stateTargets: [
      {
        targetScreenId: "modal-1",
        edgeType: "open-modal",
        trigger: { label: "Open" },
      },
    ],
  },
  { id: "about", name: "About", path: "/about", type: "page" },
  {
    id: "modal-1",
    name: "Modal",
    path: "/",
    type: "modal",
    parentScreenId: "home",
    stateKey: "modal:1",
  },
];

describe("appflow-analysis-mode", () => {
  it("defaults to shadow", () => {
    expect(parseAppflowAnalysisMode(undefined)).toBe(DEFAULT_APPFLOW_ANALYSIS_MODE);
    expect(parseAppflowAnalysisMode("")).toBe("shadow");
    expect(parseAppflowAnalysisMode("engine")).toBe("engine");
    expect(parseAppflowAnalysisMode("nope")).toBe("shadow");
  });
});

describe("projectUiGraphToAppflow", () => {
  it("preserves navigate and open transitions (no drop)", () => {
    const graph = adaptLegacyScreensToUiGraph({ projectId: "demo", screens });
    // synthesize close-surface
    graph.transitions.push({
      id: "ui:tr:close",
      kind: "close-surface",
      fromSurfaceId: "ui:surface:modal-1",
      toSurfaceId: "ui:surface:home",
      status: "inferred",
      confidence: 0.5,
      evidenceIds: [],
    });
    graph.transitions.push({
      id: "ui:tr:menu",
      kind: "menu-action",
      fromSurfaceId: "ui:surface:home",
      toSurfaceId: "ui:surface:modal-1",
      status: "inferred",
      confidence: 0.5,
      evidenceIds: [],
    });
    const model = projectUiGraphToAppflow(graph);
    expect(model.edges.some((edge) => edge.type === "navigate")).toBe(true);
    expect(model.edges.some((edge) => edge.type === "open-modal")).toBe(true);
    expect(model.edges.some((edge) => edge.type === "close-surface")).toBe(true);
    expect(model.edges.some((edge) => edge.type === "menu-action")).toBe(true);
    expect(model.screens).toHaveLength(3);
  });
});

describe("resolveAppflowAnalysis", () => {
  it("engine mode renders from UI graph projection without losing evidenced transitions", () => {
    const result = resolveAppflowAnalysis({
      mode: "engine",
      projectId: "demo",
      legacyScreens: screens,
    });
    expect(result.source).toBe("engine-projection");
    expect(result.screens.map((screen) => screen.id).sort()).toEqual(["about", "home", "modal-1"]);
    expect(result.edges.some((edge) => edge.type === "navigate")).toBe(true);
    expect(result.edges.some((edge) => edge.type === "open-modal")).toBe(true);
    expect(result.parity?.passed).toBe(true);
  });

  it("shadow keeps legacy render but attaches engine statuses and parity", () => {
    const result = resolveAppflowAnalysis({
      mode: "shadow",
      projectId: "demo",
      legacyScreens: screens,
    });
    expect(result.source).toBe("legacy");
    expect(result.screens).toHaveLength(3);
    expect(result.parity?.screenCountMatch).toBe(true);
    expect(result.surfaceStatusByScreenId.home).toBeDefined();
  });

  it("exposes conflicted status instead of false verification", () => {
    const crawl: RuntimeObserverCrawlResult = {
      baseUrl: "http://localhost",
      crawledAt: "2026-10-03T12:00:00.000Z",
      summary: {
        visitedScreens: 1,
        attemptedClicks: 0,
        verifiedEdges: 0,
        stateCaptures: 0,
        mismatchCount: 1,
        issueCount: 1,
      },
      snapshots: [
        {
          screenId: "home",
          route: "/",
          interactiveCount: 1,
          containerCount: 0,
          openContainerCount: 0,
        },
      ],
      verifiedEdges: [],
      stateScreens: [],
      issues: [
        {
          code: "dom_without_graph_match",
          severity: "warning",
          screenId: "home",
          message: "Mismatch",
        },
      ],
    };
    const result = resolveAppflowAnalysis({
      mode: "engine",
      projectId: "demo",
      legacyScreens: screens,
      runtimeCrawl: crawl,
    });
    expect(result.surfaceStatusByScreenId.home).toBe("conflicted");
  });
});
