/**
 * Wave 3 atlas 3D polish gate.
 * Acceptance: .qa/acceptance/wave3-atlas-3d-polish.md
 */

import { test, expect } from "@playwright/test";
import { installWave2Mocks, openBlueprintView, seedSupabaseSession } from "./wave2-test-helpers.js";

const PROJECT_ID = "proj-wave3-atlas";

test.describe("Wave 3 atlas 3D polish", () => {
  test("clusters have labels, selection, and inspector", async ({ page }) => {
    test.setTimeout(60_000);
    await seedSupabaseSession(page);
    await installWave2Mocks(page, PROJECT_ID, "wave3-atlas-1");
    await openBlueprintView(page, "atlas");

    expect(await page.getByTestId("atlas-cluster").count()).toBeGreaterThanOrEqual(6);
    expect(await page.getByTestId("atlas-cluster-label").count()).toBeGreaterThanOrEqual(6);
    await expect(page.getByTestId("atlas-cluster").first()).toHaveAttribute(
      "data-selected",
      "true",
      { timeout: 15000 },
    );
    await expect(page.getByTestId("atlas-inspector")).toBeVisible();
  });
});
