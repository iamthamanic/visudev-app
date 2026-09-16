/**
 * Pipeline-honest-throughput UI gates: overlays, treemap, open-in-editor, level nav.
 * Acceptance: .qa/acceptance/pipeline-honest-throughput.md
 */

import { test, expect } from "@playwright/test";
import {
  buildMockBlueprint,
  installWave2Mocks,
  openBlueprintView,
  seedSupabaseSession,
} from "./wave2-test-helpers.js";

const EVIDENCE_DIR = ".qa/evidence/pipeline-honest-throughput";
const PROJECT_ID = "proj-pipeline-honest";

function buildThroughputBlueprint(projectId: string) {
  const base = buildMockBlueprint(projectId);
  const graph = base.graph!;
  const extraModules = [
    {
      id: "module:auth",
      kind: "module" as const,
      label: "auth",
      filePath: "src/modules/auth/index.ts",
      line: 1,
      metadata: {},
    },
    {
      id: "module:billing",
      kind: "module" as const,
      label: "billing",
      filePath: "src/modules/billing/index.ts",
      line: 1,
      metadata: {},
    },
    {
      id: "module:hr",
      kind: "module" as const,
      label: "hr",
      filePath: "src/modules/hr/index.ts",
      line: 1,
      metadata: {},
    },
  ];
  const fileNode = {
    id: "file:src/routes/employees.ts",
    kind: "file" as const,
    label: "employees.ts",
    filePath: "src/routes/employees.ts",
    line: 12,
    metadata: {},
  };
  return {
    ...base,
    repo: "/tmp/visudev-e2e-project",
    repoUrl: "https://github.com/browo/hr-tool",
    totalFiles: 2000,
    truncation: {
      filesAnalyzed: 800,
      filesDiscovered: 2000,
      factsKept: 900,
      factsDropped: 100,
      truncated: true,
    },
    semanticSystemModel: {
      entities: [
        { id: "semantic:application:app", kind: "application", label: "App" },
        { id: "semantic:business-domain:hr", kind: "business-domain", label: "HR" },
        { id: "semantic:service:auth", kind: "service", label: "Auth" },
      ],
      memberships: [],
    },
    graph: {
      ...graph,
      nodes: [...graph.nodes, ...extraModules, fileNode],
      edges: [
        ...graph.edges,
        {
          id: "edge:auth-billing",
          kind: "imports" as const,
          sourceId: "module:auth",
          targetId: "module:billing",
          metadata: { evidenceKind: "extracted" },
        },
        {
          id: "edge:auth-hr",
          kind: "calls" as const,
          sourceId: "module:auth",
          targetId: "module:hr",
          metadata: { evidenceKind: "inferred" },
        },
      ],
    },
  };
}

test.describe("Pipeline honest throughput visuals", () => {
  test.beforeEach(async ({ page }) => {
    await seedSupabaseSession(page);
    await installWave2Mocks(page, PROJECT_ID, "pipeline-honest-1", buildThroughputBlueprint(PROJECT_ID));
  });

  test("dependencies overlays collapse by default and filter when opened", async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await openBlueprintView(page, "dependencies");

    const overlays = page.getByTestId("dep-overlays");
    await expect(overlays).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("dep-overlay-security")).toBeHidden();

    await page.getByTestId("dep-overlays-summary").click();
    await expect(page.getByTestId("dep-overlay-security")).toBeVisible();
    await page.getByTestId("dep-overlay-api").check();
    await expect(page.getByTestId("dep-overlay-api")).toBeChecked();

    await page.screenshot({
      path: `${EVIDENCE_DIR}/01-dependencies-overlays.png`,
      fullPage: false,
    });
  });

  test("atlas shows treemap when modules exist", async ({ page }) => {
    test.setTimeout(60_000);
    await openBlueprintView(page, "atlas");

    await expect(page.getByTestId("atlas-treemap")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("view-state-partial-scan")).toBeVisible();

    await page.screenshot({
      path: `${EVIDENCE_DIR}/02-atlas-treemap-truncation.png`,
      fullPage: false,
    });
  });

  test("architecture level nav is a single select", async ({ page }) => {
    test.setTimeout(60_000);
    await openBlueprintView(page, "architecture");

    const select = page.getByTestId("arch-level-select");
    await expect(select).toBeVisible({ timeout: 20_000 });
    await select.selectOption("module");
    await expect(page.getByTestId("arch-level-current")).toHaveText("Modul");

    await page.screenshot({
      path: `${EVIDENCE_DIR}/03-architecture-level-nav.png`,
      fullPage: false,
    });
  });

  test("open-in-editor links appear for selected dependency node with repoUrl", async ({ page }) => {
    test.setTimeout(60_000);
    await openBlueprintView(page, "dependencies");

    const inspector = page.getByTestId("dependency-inspector");
    await expect(inspector).toBeVisible({ timeout: 20_000 });

    // Prefer a file-bearing node from the search list / canvas.
    const search = page.getByPlaceholder(/suchen/i);
    if ((await search.count()) > 0) {
      await search.fill("employees");
    }

    const openEditor = page.getByTestId("open-in-editor");
    await expect(openEditor).toBeVisible({ timeout: 20_000 });
    await expect(openEditor.getByRole("link", { name: /GitHub|Cursor|VS Code/i }).first()).toBeVisible();

    await page.screenshot({
      path: `${EVIDENCE_DIR}/04-open-in-editor.png`,
      fullPage: false,
    });
  });
});
