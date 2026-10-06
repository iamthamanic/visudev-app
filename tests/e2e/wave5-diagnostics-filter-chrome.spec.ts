/**
 * Wave 5 diagnostics filter chrome gate.
 * Acceptance: .qa/acceptance/wave5-diagnostics-filter-chrome.md
 */

import { test, expect } from "@playwright/test";
import {
  buildDiagnosticsMockBlueprint,
  installWave2Mocks,
  openBlueprintView,
  openDiagnosticsTechnikContext,
  seedSupabaseSession,
} from "./wave2-test-helpers.js";

const PROJECT_ID = "proj-wave5-diagnostics";

test.describe("Wave 5 diagnostics filter chrome", () => {
  test("severity/area/search filters and matrix status badges", async ({ page }) => {
    test.setTimeout(60_000);
    await seedSupabaseSession(page);
    await installWave2Mocks(
      page,
      PROJECT_ID,
      "wave5-diag-1",
      buildDiagnosticsMockBlueprint(PROJECT_ID),
    );
    await openBlueprintView(page, "diagnostics");

    await expect(page.getByTestId("findings-severity-filter")).toBeVisible();
    await expect(page.getByTestId("findings-area-filter")).toBeVisible();
    await expect(page.getByTestId("findings-search")).toBeVisible();
    await expect(page.getByTestId("findings-severity-filter")).toContainText(/Alle Schweregrade/i);
    await expect(page.getByTestId("findings-area-filter")).toContainText(/Alle Bereiche/i);

    await openDiagnosticsTechnikContext(page);
    expect(await page.getByTestId("matrix-status-badge").count()).toBeGreaterThanOrEqual(3);
    await expect(page.getByTestId("matrix-status-badge").first()).toBeVisible();

    const pagination = page.getByTestId("findings-pagination");
    await expect(pagination).toContainText(/von\s*24|24\s*Findings/i);

    await page.getByTestId("findings-severity-filter").selectOption("critical");
    await expect(page.getByTestId("findings-table")).toBeVisible();
  });
});
