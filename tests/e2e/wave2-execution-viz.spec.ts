/**
 * Wave 2 execution viz parity gate.
 * Acceptance: .qa/acceptance/wave2-execution-viz-parity.md
 */

import { test, expect } from "@playwright/test";
import { installWave2Mocks, openBlueprintView, seedSupabaseSession } from "./wave2-test-helpers.js";

const EVIDENCE_DIR = ".qa/evidence/wave2-execution-viz";
const PROJECT_ID = "proj-wave2-execution";

test.describe("Wave 2 execution viz parity", () => {
  test.beforeEach(async ({ page }) => {
    await seedSupabaseSession(page);
    await installWave2Mocks(page, PROJECT_ID, "wave2-execution-1");
  });

  test("pipeline, metrics bar, live badge, and payload tab", async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await openBlueprintView(page, "execution");

    await expect(page.getByTestId("execution-mode-badge")).toBeVisible({ timeout: 20000 });
    await expect(page.getByTestId("execution-mode-badge")).toContainText(/Projektion|Live/);
    expect(await page.getByTestId("execution-step-card").count()).toBeGreaterThanOrEqual(6);
    await expect(page.getByTestId("execution-metrics-bar")).toBeVisible();

    await page
      .getByRole("button", { name: /CreateLeaveRequest/i })
      .first()
      .click();

    await page.getByRole("tab", { name: "Payload" }).click();
    const payloadPanel = page.getByTestId("execution-detail-tab-payload");
    await expect(payloadPanel).toBeVisible({ timeout: 10000 });
    await expect(payloadPanel).toContainText("resourceRef");

    await page.screenshot({
      path: `${EVIDENCE_DIR}/execution-pipeline-detail.png`,
      fullPage: false,
    });
  });
});
