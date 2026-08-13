/**
 * Post-Wave-2 Figma Zielbild comparison — capture all 7 Blueprint views.
 * Evidence: .qa/evidence/figma-compare-v3/current-{view}.png
 * Uses wave2-test-helpers (browo/hr-tool demo graph + mocks).
 */

import { test, expect, type Page } from "@playwright/test";
import {
  buildDiagnosticsMockBlueprint,
  installWave2Mocks,
  openBlueprintView,
  seedSupabaseSession,
} from "./wave2-test-helpers.js";

const EVIDENCE_DIR = ".qa/evidence/figma-compare-v3";
const PROJECT_ID = "proj-figma-compare-v3";
const ANALYSIS_ID = "figma-compare-v3-1";

const VIEWS = [
  { id: "architecture", heading: /Architektur/i },
  { id: "dependencies", heading: /Abhängigkeiten/i },
  { id: "execution", heading: /Ausführung/i },
  { id: "infrastructure", heading: /Infrastruktur/i },
  { id: "atlas", heading: /Atlas/i },
  { id: "evolution", heading: /Evolution/i },
  { id: "diagnostics", heading: /Diagnosen/i },
] as const;

async function waitForScanAndEnrichment(page: Page, viewId: string) {
  const loading = page.getByText(/Blueprint wird (generiert|analysiert)/i);
  if (await loading.isVisible().catch(() => false)) {
    await loading.waitFor({ state: "hidden", timeout: 45000 });
  }

  await expect(page.getByTitle("browo/hr-tool")).toBeVisible();
  await expect(page.getByTestId("blueprint-view")).toBeVisible({ timeout: 20000 });

  const mainContent = page.getByTestId("blueprint-main-content");
  await expect(mainContent).toBeVisible({ timeout: 20000 });
  await expect(mainContent).not.toBeEmpty();

  switch (viewId) {
    case "architecture":
      await expect(page.getByTestId("architecture-layer-stack")).toBeVisible({ timeout: 15000 });
      await expect(page.getByTestId("layer-card")).toHaveCount(7);
      break;
    case "dependencies":
      expect(await page.getByTestId("relationship-chip").count()).toBeGreaterThanOrEqual(5);
      await expect(page.getByTestId("dependency-inspector")).toBeVisible();
      break;
    case "execution":
      await expect(page.getByTestId("execution-mode-badge")).toBeVisible();
      expect(await page.getByTestId("execution-step-card").count()).toBeGreaterThanOrEqual(6);
      break;
    case "infrastructure":
      expect(await page.getByTestId("infra-topology-node").count()).toBeGreaterThanOrEqual(10);
      break;
    case "atlas":
      await expect(page.getByTestId("atlas-stats-bar")).toBeVisible();
      expect(await page.getByTestId("atlas-cluster").count()).toBeGreaterThanOrEqual(6);
      break;
    case "evolution":
      await expect(page.getByTestId("evolution-timeline")).toBeVisible();
      await expect(page.getByTestId("evolution-snapshot-card")).toHaveCount(5);
      expect(await page.getByTestId("evolution-metric-card").count()).toBeGreaterThanOrEqual(6);
      break;
    case "diagnostics":
      await expect(page.getByTestId("security-matrix")).toBeVisible();
      await expect(page.getByTestId("findings-table")).toBeVisible();
      break;
  }

  await page.waitForTimeout(500);
}

test.describe("Wave 2 Figma Zielbild comparison (v3)", () => {
  for (const view of VIEWS) {
    test(`capture ${view.id} for Zielbild comparison`, async ({ page }) => {
      test.setTimeout(90_000);
      await seedSupabaseSession(page);
      const blueprintOverride =
        view.id === "diagnostics" ? buildDiagnosticsMockBlueprint(PROJECT_ID) : undefined;
      await installWave2Mocks(page, PROJECT_ID, ANALYSIS_ID, blueprintOverride);

      await page.setViewportSize({ width: 1440, height: 900 });
      await openBlueprintView(page, view.id);
      await waitForScanAndEnrichment(page, view.id);

      await page.screenshot({
        path: `${EVIDENCE_DIR}/current-${view.id}.png`,
        fullPage: false,
      });
    });
  }
});
