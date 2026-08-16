/**
 * Wave 5 Atlas cyber-city polish gate.
 * Acceptance: .qa/acceptance/wave5-atlas-cyber-polish.md
 */

import { test, expect } from "@playwright/test";
import { installWave2Mocks, openBlueprintView, seedSupabaseSession } from "./wave2-test-helpers.js";

const PROJECT_ID = "proj-wave5-atlas";

test.describe("Wave 5 atlas cyber polish", () => {
  test("glow plates, coverage ≥90%, dense semantic inspector", async ({ page }) => {
    test.setTimeout(60_000);
    await seedSupabaseSession(page);
    await installWave2Mocks(page, PROJECT_ID, "wave5-atlas-1");
    await openBlueprintView(page, "atlas");

    expect(await page.getByTestId("atlas-cluster").count()).toBeGreaterThanOrEqual(6);
    expect(await page.getByTestId("atlas-glow-plate").count()).toBeGreaterThanOrEqual(6);

    const highCoverage = page.locator('[data-testid="atlas-cluster"][data-coverage]');
    const coverageCount = await highCoverage.count();
    let above90 = 0;
    for (let i = 0; i < coverageCount; i += 1) {
      const value = Number(await highCoverage.nth(i).getAttribute("data-coverage"));
      if (Number.isFinite(value) && value >= 90) above90 += 1;
    }
    expect(above90).toBeGreaterThanOrEqual(4);

    const semanticCluster = page.getByTestId("atlas-cluster").first();
    await semanticCluster.click();
    await expect(semanticCluster).toHaveAttribute("data-selected", "true");
    await expect(page.getByTestId("atlas-cluster-glow")).toHaveCount(1);

    const inspector = page.getByTestId("atlas-inspector");
    await expect(inspector).toBeVisible();
    await expect(page.getByTestId("atlas-inspector-overview")).toBeVisible();
    expect(await page.getByTestId("atlas-tech-chip").count()).toBeGreaterThanOrEqual(1);
    expect(await page.getByTestId("atlas-activity-item").count()).toBeGreaterThanOrEqual(3);
  });
});
