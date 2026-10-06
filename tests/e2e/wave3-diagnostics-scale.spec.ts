/**
 * Wave 3 diagnostics scale gate.
 * Acceptance: .qa/acceptance/wave3-diagnostics-scale.md
 */

import { test, expect } from "@playwright/test";
import {
  buildDiagnosticsMockBlueprint,
  installWave2Mocks,
  openBlueprintView,
  openDiagnosticsInspectorTechnik,
  openDiagnosticsTechnikContext,
  seedSupabaseSession,
} from "./wave2-test-helpers.js";

const PROJECT_ID = "proj-wave3-diagnostics";

test.describe("Wave 3 diagnostics scale", () => {
  test("matrix rows, paginated findings, SQL evidence", async ({ page }) => {
    test.setTimeout(60_000);
    await seedSupabaseSession(page);
    await installWave2Mocks(
      page,
      PROJECT_ID,
      "wave3-diag-1",
      buildDiagnosticsMockBlueprint(PROJECT_ID),
    );
    await openBlueprintView(page, "diagnostics");

    const pagination = page.getByTestId("findings-pagination");
    await expect(pagination).toBeVisible();
    await expect(pagination).toContainText(/24|von/i);

    await openDiagnosticsTechnikContext(page);
    expect(await page.getByTestId("security-matrix-row").count()).toBeGreaterThanOrEqual(5);

    await openDiagnosticsInspectorTechnik(page);
    const evidence = page.getByTestId("problem-inspector-evidence");
    await expect(evidence).toBeVisible({ timeout: 15000 });
    await expect(evidence).toContainText(/SELECT|SQL|employees/i);
  });
});
