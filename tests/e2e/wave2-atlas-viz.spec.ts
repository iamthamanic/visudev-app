/**
 * Wave 2 atlas viz parity gate.
 * Acceptance: .qa/acceptance/wave2-atlas-viz-parity.md
 */

import { test, expect } from "@playwright/test";
import { installWave2Mocks, openBlueprintView, seedSupabaseSession } from "./wave2-test-helpers.js";

const EVIDENCE_DIR = ".qa/evidence/wave2-atlas-viz";
const PROJECT_ID = "proj-wave2-atlas";

test.describe("Wave 2 atlas viz parity", () => {
  test.beforeEach(async ({ page }) => {
    await seedSupabaseSession(page);
    await installWave2Mocks(page, PROJECT_ID, "wave2-atlas-1");
  });

  test("stats bar, clusters, legend, zoom, and inspector on cluster click", async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await openBlueprintView(page, "atlas");

    const statsBar = page.getByTestId("atlas-stats-bar");
    await expect(statsBar).toBeVisible({ timeout: 20000 });
    expect(await page.locator('[data-testid^="atlas-stat-"]').count()).toBeGreaterThanOrEqual(4);
    expect(await page.getByTestId("atlas-cluster").count()).toBeGreaterThanOrEqual(6);
    await expect(page.getByTestId("atlas-legend-item")).toHaveCount(7);
    await expect(page.getByTestId("atlas-zoom-controls")).toBeVisible();

    await page.getByTestId("atlas-cluster").first().click();
    await expect(page.getByRole("heading", { name: /WEB APP|API SERVICE|WORKER/i })).toBeVisible();

    await page.screenshot({
      path: `${EVIDENCE_DIR}/atlas-canvas-inspector.png`,
      fullPage: false,
    });
  });
});
