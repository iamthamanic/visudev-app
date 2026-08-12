/**
 * Wave 2 evolution viz parity gate.
 * Acceptance: .qa/acceptance/wave2-evolution-viz-parity.md
 */

import { test, expect } from "@playwright/test";
import { installWave2Mocks, openBlueprintView, seedSupabaseSession } from "./wave2-test-helpers.js";

const EVIDENCE_DIR = ".qa/evidence/wave2-evolution-viz";
const PROJECT_ID = "proj-wave2-evolution";

test.describe("Wave 2 evolution viz parity", () => {
  test.beforeEach(async ({ page }) => {
    await seedSupabaseSession(page);
    await installWave2Mocks(page, PROJECT_ID, "wave2-evolution-1");
  });

  test("timeline, snapshots, metrics, changes grid, and inspector", async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await openBlueprintView(page, "evolution");

    const timeline = page.getByTestId("evolution-timeline");
    await expect(timeline).toBeVisible({ timeout: 20000 });
    expect(await page.getByTestId("evolution-timeline-commit").count()).toBeGreaterThanOrEqual(3);

    await expect(page.getByTestId("evolution-snapshot-card")).toHaveCount(5);
    expect(await page.getByTestId("evolution-metric-card").count()).toBeGreaterThanOrEqual(6);
    await expect(page.getByTestId("evolution-changes-column")).toHaveCount(4);

    await page.getByTestId("evolution-timeline-commit").nth(1).click();
    await expect(page.getByTestId("evolution-inspector")).toBeVisible();
    await expect(
      page.getByTestId("evolution-inspector").getByText("Payroll Integration"),
    ).toBeVisible();

    await page.screenshot({
      path: `${EVIDENCE_DIR}/evolution-timeline-inspector.png`,
      fullPage: false,
    });
  });
});
