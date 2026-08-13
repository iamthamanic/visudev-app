/**
 * Wave 2 infrastructure viz parity gate.
 * Acceptance: .qa/acceptance/wave2-infrastructure-viz-parity.md
 */

import { test, expect } from "@playwright/test";
import { installWave2Mocks, openBlueprintView, seedSupabaseSession } from "./wave2-test-helpers.js";

const EVIDENCE_DIR = ".qa/evidence/wave2-infrastructure-viz";
const PROJECT_ID = "proj-wave2-infrastructure";

test.describe("Wave 2 infrastructure viz parity", () => {
  test.beforeEach(async ({ page }) => {
    await seedSupabaseSession(page);
    await installWave2Mocks(page, PROJECT_ID, "wave2-infrastructure-1");
  });

  test("full topology tiers and inspector resource meters", async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await openBlueprintView(page, "infrastructure");

    expect(await page.getByTestId("infra-topology-node").count()).toBeGreaterThanOrEqual(10);
    await expect(page.getByTestId("infra-external-apis")).toBeVisible();
    await expect(page.getByTestId("infra-monitoring-tier")).toBeVisible();

    await page
      .getByTestId("infra-topology-node")
      .filter({ hasText: /Web App/i })
      .first()
      .click();
    // Honest-Core P0-2: no placeholder meters. Demo graph has no telemetry → empty state.
    await expect(page.getByTestId("infra-runtime-empty")).toBeVisible();

    await page.screenshot({
      path: `${EVIDENCE_DIR}/infrastructure-topology-inspector.png`,
      fullPage: false,
    });
  });
});
