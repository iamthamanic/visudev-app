/**
 * Wave 4 execution FEHLT reduction + default payload gate.
 * Acceptance: .qa/acceptance/wave4-execution-fehlts.md
 */

import { test, expect } from "@playwright/test";
import { installWave2Mocks, openBlueprintView, seedSupabaseSession } from "./wave2-test-helpers.js";

const PROJECT_ID = "proj-wave4-execution";

test.describe("Wave 4 execution FEHLT / payload", () => {
  test("few FEHLT badges and payload JSON on default path", async ({ page }) => {
    test.setTimeout(60_000);
    await seedSupabaseSession(page);
    await installWave2Mocks(page, PROJECT_ID, "wave4-exec-1");
    await openBlueprintView(page, "execution");

    await expect(page.getByTestId("execution-step-card").first()).toBeVisible();
    const fehltCount = await page.getByText(/fehlt/i).count();
    expect(fehltCount).toBeLessThanOrEqual(1);

    const payload = page.getByTestId("execution-payload");
    await expect(payload).toBeVisible({ timeout: 15000 });
    await expect(payload).toContainText("{");
    await expect(payload).toContainText(/resourceRef|accepted|status/i);
  });
});
