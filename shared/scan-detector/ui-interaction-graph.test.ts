/**
 * Unit tests for SDE-10 UIInteractionGraph adapters and runtime fusion.
 */

import { describe, expect, it } from "vitest";
import { adaptLegacyScreensToUiGraph } from "./application/adapt-legacy-screens-to-ui-graph.js";
import { projectUiGraphToLegacyScreens } from "./application/project-ui-graph-to-legacy-screens.js";
import { fuseRuntimeIntoUiGraph } from "./application/fuse-runtime-into-ui-graph.js";
import { createWebUiDetector } from "./application/create-web-ui-detector.js";
import type { LegacyScreenLike } from "../ui-interaction-graph.types.js";
import type { RuntimeObserverCrawlResult } from "./domain/runtime/crawl-result.js";

const screens: LegacyScreenLike[] = [
  {
    id: "home",
    name: "Home",
    path: "/",
    filePath: "src/pages/index.tsx",
    type: "page",
    framework: "next",
    navigatesTo: ["about"],
    stateTargets: [
      {
        targetScreenId: "create-modal",
        edgeType: "open-modal",
        trigger: { label: "Create", file: "src/pages/index.tsx", line: 40 },
      },
    ],
  },
  {
    id: "about",
    name: "About",
    path: "/about",
    filePath: "src/pages/about.tsx",
    type: "page",
  },
  {
    id: "create-modal",
    name: "Create modal",
    path: "/",
    type: "modal",
    parentScreenId: "home",
    stateKey: "modal:create",
  },
];

describe("UIInteractionGraph SDE-10", () => {
  it("models surfaces and transitions independent of forcing Screen[] authority", () => {
    const graph = adaptLegacyScreensToUiGraph({ projectId: "demo", screens });
    expect(graph.surfaces.length).toBe(3);
    expect(graph.transitions.length).toBeGreaterThanOrEqual(2);
    expect(graph.evidence.every((item) => item.origin === "heuristic")).toBe(true);
    expect(graph.surfaces.some((surface) => surface.kind === "modal")).toBe(true);
    expect(graph.surfaces.every((surface) => surface.status === "inferred")).toBe(true);
  });

  it("projects legacy Screen[] from the UI graph for AppFlow compat", () => {
    const graph = adaptLegacyScreensToUiGraph({ projectId: "demo", screens });
    const projected = projectUiGraphToLegacyScreens(graph);
    expect(projected.map((screen) => screen.id).sort()).toEqual(["about", "create-modal", "home"]);
    const home = projected.find((screen) => screen.id === "home")!;
    expect(home.navigatesTo).toContain("about");
    expect(home.stateTargets?.some((target) => target.targetScreenId === "create-modal")).toBe(
      true,
    );
    expect(projected.find((screen) => screen.id === "create-modal")?.type).toBe("modal");
  });

  it("fuses runtime: verify, conflict, and runtime-only states", () => {
    const graph = adaptLegacyScreensToUiGraph({ projectId: "demo", screens });
    const crawl: RuntimeObserverCrawlResult = {
      baseUrl: "http://localhost",
      crawledAt: "2026-10-02T20:00:00.000Z",
      summary: {
        visitedScreens: 1,
        attemptedClicks: 1,
        verifiedEdges: 1,
        stateCaptures: 1,
        mismatchCount: 1,
        issueCount: 1,
      },
      snapshots: [
        {
          screenId: "home",
          route: "/",
          interactiveCount: 2,
          containerCount: 1,
          openContainerCount: 1,
        },
      ],
      verifiedEdges: [
        {
          fromScreenId: "home",
          toScreenId: "create-modal",
          type: "open-modal",
          verification: "state-change",
          sourceRoute: "/",
        },
      ],
      stateScreens: [
        {
          screenId: "mystery-drawer",
          parentScreenId: "home",
          type: "modal",
          label: "Mystery",
        },
      ],
      issues: [
        {
          code: "dom_without_graph_match",
          severity: "warning",
          screenId: "home",
          message: "State-Change konnte keinem Screen zugeordnet werden.",
        },
      ],
    };

    const fused = fuseRuntimeIntoUiGraph({ graph, crawl });
    const home = fused.surfaces.find((surface) => surface.attributes?.legacyScreenId === "home");
    expect(home?.status).toBe("conflicted");
    expect(fused.surfaces.some((surface) => surface.attributes?.runtimeOnly === true)).toBe(true);
    expect(fused.stats.runtimeOnlyCount).toBeGreaterThan(0);
    expect(fused.stats.conflictCount).toBeGreaterThan(0);
    const verifiedTransition = fused.transitions.find(
      (transition) =>
        transition.fromSurfaceId === home?.id &&
        transition.kind === "open-surface" &&
        transition.status === "verified",
    );
    expect(verifiedTransition).toBeTruthy();
  });

  it("web UI detector emits engine facts via the port", async () => {
    const detector = createWebUiDetector({
      getLegacyScreens: () => screens,
    });
    const result = await detector.run({
      projectId: "demo",
      enrichment: "off",
      requestedCapabilityIds: ["web-ui-interaction-graph"],
      budget: { timeoutMs: 5_000 },
    });
    expect(result.status).toBe("success");
    expect(result.facts.some((fact) => fact.kind.startsWith("ui.surface."))).toBe(true);
    expect(result.evidence.length).toBeGreaterThan(0);
  });
});
