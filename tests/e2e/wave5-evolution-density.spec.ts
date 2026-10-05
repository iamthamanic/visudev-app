/**
 * Wave 5 evolution density gate.
 * Acceptance: .qa/acceptance/wave5-evolution-density.md
 */

import { test, expect } from "@playwright/test";
import { installWave2Mocks, openBlueprintView, seedSupabaseSession } from "./wave2-test-helpers.js";

const PROJECT_ID = "proj-wave5-evolution";

test.describe("Wave 5 evolution density", () => {
  test("timeline commits, snapshot thumbs, changes grid", async ({ page }) => {
    test.setTimeout(60_000);
    await seedSupabaseSession(page);
    await installWave2Mocks(page, PROJECT_ID, "wave5-evo-1");
    await openBlueprintView(page, "evolution");

    await expect(page.getByTestId("evolution-timeline")).toBeVisible();
    expect(await page.getByTestId("evolution-timeline-commit").count()).toBeGreaterThanOrEqual(5);
    await expect(page.getByTestId("evolution-timeline-commit").first()).toContainText(/.+/);

    expect(await page.getByTestId("evolution-snapshot-card").count()).toBeGreaterThanOrEqual(5);
    expect(await page.getByTestId("evolution-snapshot-thumb").count()).toBeGreaterThanOrEqual(5);

    await expect(page.getByTestId("evolution-changes-grid")).toBeVisible();
    expect(await page.getByTestId("evolution-changes-column").count()).toBe(5);
    expect(await page.getByTestId("evolution-metric-card").count()).toBeGreaterThanOrEqual(6);
  });
});
