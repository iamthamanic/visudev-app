/**
 * Wave 3 evolution git timeline gate.
 * Acceptance: .qa/acceptance/wave3-evolution-git-timeline.md
 */

import { test, expect } from "@playwright/test";
import { installWave2Mocks, openBlueprintView, seedSupabaseSession } from "./wave2-test-helpers.js";

const PROJECT_ID = "proj-wave3-evolution";

test.describe("Wave 3 evolution git timeline", () => {
  test("timeline shows commit dots from git summary", async ({ page }) => {
    test.setTimeout(60_000);
    await seedSupabaseSession(page);
    await installWave2Mocks(page, PROJECT_ID, "wave3-evo-1");
    await openBlueprintView(page, "evolution");

    await expect(page.getByTestId("evolution-timeline")).toBeVisible({ timeout: 20000 });
    expect(await page.getByTestId("evolution-timeline-commit").count()).toBeGreaterThanOrEqual(3);
  });
});
