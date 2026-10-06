/**
 * Wave 2 dependencies viz parity gate.
 * Acceptance: .qa/acceptance/wave2-dependencies-viz-parity.md
 */

import { test, expect } from "@playwright/test";
import {
  installWave2Mocks,
  openBlueprintView,
  openDependenciesTechnikLayer,
  seedSupabaseSession,
} from "./wave2-test-helpers.js";

const EVIDENCE_DIR = ".qa/evidence/wave2-dependencies-viz";
const PROJECT_ID = "proj-wave2-dependencies";

test.describe("Wave 2 dependencies viz parity", () => {
  test.beforeEach(async ({ page }) => {
    await seedSupabaseSession(page);
    await installWave2Mocks(page, PROJECT_ID, "wave2-dependencies-1");
  });

  test("relationship chips, edge labels, and inspector on load", async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await openBlueprintView(page, "dependencies");

    await expect(page.getByTestId("dependencies-impact-inspector")).toBeVisible();
    await openDependenciesTechnikLayer(page);

    await expect(page.getByTestId("relationship-chip")).toHaveCount(8);
    await expect(page.getByTestId("edge-label").first()).toBeVisible();
    expect(await page.getByTestId("edge-label").count()).toBeGreaterThanOrEqual(3);
    await expect(page.getByTestId("dependency-inspector")).toBeVisible();
    await expect(page.getByText(/eingehend/i)).toBeVisible();
    await expect(page.getByText(/ausgehend/i)).toBeVisible();

    await page.screenshot({
      path: `${EVIDENCE_DIR}/dependencies-graph-inspector.png`,
      fullPage: false,
    });
  });
});
