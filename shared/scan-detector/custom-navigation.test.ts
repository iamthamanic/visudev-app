/**
 * PU-05: custom navigation detection — HarborDesk fixture (not SagaDrive / golden repos).
 */
import { describe, expect, it } from "vitest";
import { adaptLegacyScreensToUiGraph } from "./application/adapt-legacy-screens-to-ui-graph.js";
import { extractCustomNavigation } from "./application/extract-custom-navigation.js";
import {
  customNavigationToLegacyScreens,
  mergeCustomNavigationIntoUiGraph,
} from "./application/merge-custom-navigation-into-ui-graph.js";

/** Fictional app vocabulary — must not overlap SagaDrive / VisuDEV golden terms. */
const HARBOR_DESK_ROUTES = `
export const HarborRoutes = {
  manifest: '/harbor/manifest',
  quartermaster: '/harbor/quartermaster',
  tidewatch: '/harbor/tidewatch',
} as const;

export type HarborPane = 'manifest' | 'quartermaster' | 'tidewatch';

export function composeHarborPath(pane: HarborPane): string {
  return HarborRoutes[pane];
}

export function openHarborPane(pane: HarborPane) {
  const literal = composeHarborPath('manifest');
  const dynamic = composeHarborPath(pane);
  const nested = \`/harbor/\${pane}/detail\`;
  void literal;
  void dynamic;
  void nested;
  return literal;
}

export function renderHarborPane(activePane: HarborPane) {
  switch (activePane) {
    case 'manifest':
      return <ManifestDock />;
    case 'quartermaster':
      return <QuartermasterDock />;
    case 'tidewatch':
      return <TidewatchDock />;
    default:
      return null;
  }
}
`;

describe("extractCustomNavigation (PU-05 HarborDesk)", () => {
  it("detects route tables, path builders, switch/union, and keeps computed paths UNKNOWN", () => {
    const result = extractCustomNavigation([
      { path: "src/harbor/navigation.ts", content: HARBOR_DESK_ROUTES },
    ]);

    expect(result.coverage.routeTablesFound).toBeGreaterThanOrEqual(1);
    expect(result.coverage.switchDispatchesFound).toBeGreaterThanOrEqual(3);
    expect(result.coverage.unionMembersFound).toBeGreaterThanOrEqual(3);
    expect(result.coverage.pathBuildersResolved).toBeGreaterThanOrEqual(1);
    expect(result.coverage.pathBuildersUnknown).toBeGreaterThanOrEqual(1);
    expect(result.coverage.status).toBe("PARTIAL");

    const paths = result.surfaces.map((s) => s.path).filter(Boolean);
    expect(paths).toContain("/harbor/manifest");
    expect(paths).toContain("/harbor/quartermaster");
    expect(paths).toContain("/harbor/tidewatch");

    const unknown = result.surfaces.filter((s) => s.status === "unknown");
    expect(unknown.length).toBeGreaterThanOrEqual(1);
    expect(unknown.every((s) => s.path === undefined)).toBe(true);
    expect(unknown.every((s) => typeof s.line === "number" && s.line >= 1)).toBe(true);

    // No SagaDrive / golden vocabulary leakage in fixture or output labels
    const blob = JSON.stringify(result).toLowerCase();
    expect(blob.includes("sagadrive")).toBe(false);
    expect(blob.includes("scriptony")).toBe(false);
    expect(blob.includes("hrkoordinator")).toBe(false);
  });

  it("merges into UIInteractionGraph with file/line evidence", () => {
    const result = extractCustomNavigation([
      { path: "src/harbor/navigation.ts", content: HARBOR_DESK_ROUTES },
    ]);
    const base = adaptLegacyScreensToUiGraph({
      projectId: "harbor-desk",
      screens: [],
    });
    const graph = mergeCustomNavigationIntoUiGraph(base, result);
    expect(graph.surfaces.length).toBeGreaterThanOrEqual(4);
    expect(graph.transitions.length).toBeGreaterThanOrEqual(1);
    const withLine = graph.evidence.filter((e) => typeof e.line === "number");
    expect(withLine.length).toBeGreaterThanOrEqual(3);
    expect(graph.surfaces.some((s) => s.status === "unknown")).toBe(true);
    expect(graph.surfaces.some((s) => s.framework === "custom-nav")).toBe(true);
  });

  it("projects legacy screens without inventing paths for UNKNOWN", () => {
    const result = extractCustomNavigation([
      { path: "src/harbor/navigation.ts", content: HARBOR_DESK_ROUTES },
    ]);
    const screens = customNavigationToLegacyScreens(result);
    const unknown = screens.filter((s) => s.knowledgeStatus === "unknown");
    expect(unknown.length).toBeGreaterThanOrEqual(1);
    expect(unknown.every((s) => !s.path)).toBe(true);
    expect(screens.some((s) => s.path === "/harbor/manifest")).toBe(true);
  });
});
