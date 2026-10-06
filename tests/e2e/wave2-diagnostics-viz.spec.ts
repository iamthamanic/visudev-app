/**
 * Wave 2 diagnostics viz parity gate.
 * Acceptance: .qa/acceptance/wave2-diagnostics-viz-parity.md
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

const EVIDENCE_DIR = ".qa/evidence/wave2-diagnostics-viz";
const PROJECT_ID = "proj-wave2-diagnostics";

test.describe("Wave 2 diagnostics viz parity", () => {
  test.beforeEach(async ({ page }) => {
    await seedSupabaseSession(page);
    await installWave2Mocks(
      page,
      PROJECT_ID,
      "wave2-diagnostics-1",
      buildDiagnosticsMockBlueprint(PROJECT_ID),
    );
  });

  test("matrix above findings, inspector evidence, resolve toggle", async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await openBlueprintView(page, "diagnostics");

    const findingsTable = page.getByTestId("findings-table");
    await expect(findingsTable).toBeVisible({ timeout: 20000 });
    await expect(page.getByTestId("findings-pagination")).toBeVisible();
    await expect(page.getByTestId("diagnostics-consequence")).toBeVisible();

    await openDiagnosticsTechnikContext(page);
    const matrix = page.getByTestId("security-matrix");
    await expect(matrix).toBeVisible({ timeout: 20000 });

    // Access Control v2 (VITE_ACCESS_CONTROL_V2): Scope/Tenant/Ownership replace RLS.
    // Legacy matrix no longer shows an RLS column (deprecated; mechanisms live in Inspector).
    const isAccessControlV2 = (await matrix.getAttribute("data-access-control-v2")) === "true";
    if (isAccessControlV2) {
      await expect(matrix.getByRole("columnheader", { name: "Scope" })).toBeVisible();
      await expect(matrix.getByRole("columnheader", { name: "Tenant" })).toBeVisible();
      await expect(matrix.getByRole("columnheader", { name: "Ownership" })).toBeVisible();
      await expect(matrix.getByRole("columnheader", { name: "RLS" })).toHaveCount(0);
    } else {
      await expect(matrix.getByRole("columnheader", { name: "DB" })).toBeVisible();
      await expect(matrix.getByRole("columnheader", { name: "RLS" })).toHaveCount(0);
    }

    const matrixBox = await matrix.boundingBox();
    const tableBox = await findingsTable.boundingBox();
    expect(matrixBox).not.toBeNull();
    expect(tableBox).not.toBeNull();
    // PU-13: findings lead; Technik matrix is below the findings section.
    if (matrixBox && tableBox) {
      expect(tableBox.y).toBeLessThan(matrixBox.y);
    }

    await openDiagnosticsInspectorTechnik(page);
    await expect(page.getByTestId("problem-inspector-evidence")).toBeVisible({ timeout: 15000 });

    await page.getByRole("button", { name: "Als erledigt markieren" }).click();
    await expect(page.getByTestId("finding-status-SEC-001")).toHaveText("Erledigt");

    await page.screenshot({
      path: `${EVIDENCE_DIR}/diagnostics-matrix-findings-inspector.png`,
      fullPage: false,
    });
  });
});
