/**
 * Wave 5 Atlas product-map polish (PU-07) — purpose-first inspector.
 * Replaces cyber-city density checks with Product Understanding Atlas gates.
 * Acceptance: .qa/acceptance/wave5-atlas-cyber-polish.md + #428
 */

import { test, expect } from "@playwright/test";
import { installWave2Mocks, openBlueprintView, seedSupabaseSession } from "./wave2-test-helpers.js";

const PROJECT_ID = "proj-wave5-atlas";

test.describe("Wave 5 atlas product-map polish", () => {
  test("product clusters, purpose inspector, optional technical refs", async ({ page }) => {
    test.setTimeout(60_000);
    await seedSupabaseSession(page);
    await installWave2Mocks(page, PROJECT_ID, "wave5-atlas-1");
    await openBlueprintView(page, "atlas");

    expect(await page.getByTestId("atlas-cluster").count()).toBeGreaterThanOrEqual(3);
    expect(await page.getByTestId("atlas-cluster-label").count()).toBeGreaterThanOrEqual(3);
    expect(await page.getByTestId("atlas-glow-plate").count()).toBeGreaterThanOrEqual(1);

    const semanticCluster = page.getByTestId("atlas-cluster").first();
    await semanticCluster.click();
    await expect(semanticCluster).toHaveAttribute("data-selected", "true");
    await expect(page.getByTestId("atlas-cluster-glow")).toHaveCount(1);

    const inspector = page.getByTestId("atlas-inspector");
    await expect(inspector).toBeVisible();
    await expect(page.getByTestId("atlas-inspector-overview")).toBeVisible();
    await expect(inspector.getByText("Zweck")).toBeVisible();
    await expect(page.getByTestId("atlas-inspector-tech")).toBeVisible();
    expect(await page.getByTestId("atlas-activity-item").count()).toBeGreaterThanOrEqual(3);
  });
});
