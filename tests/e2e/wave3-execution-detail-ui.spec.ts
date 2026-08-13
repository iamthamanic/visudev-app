/**
 * Wave 3 execution detail UI gate.
 * Acceptance: .qa/acceptance/wave3-execution-detail-ui.md
 */

import { test, expect } from "@playwright/test";
import { installWave2Mocks, openBlueprintView, seedSupabaseSession } from "./wave2-test-helpers.js";

const PROJECT_ID = "proj-wave3-execution";

test.describe("Wave 3 execution detail UI", () => {
  test("payload, headers, logs tabs show content after step select", async ({ page }) => {
    test.setTimeout(60_000);
    await seedSupabaseSession(page);
    await installWave2Mocks(page, PROJECT_ID, "wave3-exec-1");
    await openBlueprintView(page, "execution");

    await expect(page.getByTestId("execution-mode-badge")).toBeVisible();

    const createStep = page
      .getByTestId("execution-step-card")
      .filter({ hasText: /CreateLeaveRequest/i })
      .first();
    await createStep.click();

    await page.getByRole("tab", { name: "Payload" }).click();
    const payload = page.getByTestId("execution-detail-tab-payload");
    await expect(payload).toBeVisible({ timeout: 15000 });
    await expect(payload).toContainText("{");

    await page.getByRole("tab", { name: "Logs" }).click();
    const logs = page.getByTestId("execution-detail-tab-logs");
    await expect(logs).toBeVisible({ timeout: 15000 });
    await expect(logs).toContainText(/INFO|DEBUG/i);

    await page
      .getByTestId("execution-step-card")
      .filter({ hasText: /LeaveController/i })
      .first()
      .click();

    await page.getByRole("tab", { name: "Headers" }).click();
    const headers = page.getByTestId("execution-detail-tab-headers");
    await expect(headers).toBeVisible({ timeout: 15000 });
    await expect(headers).not.toBeEmpty();
  });
});
