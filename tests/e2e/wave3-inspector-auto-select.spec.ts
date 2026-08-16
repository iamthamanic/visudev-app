/**
 * Wave 3 inspector auto-selection gate.
 * Acceptance: .qa/acceptance/wave3-inspector-auto-select.md
 */

import { test, expect } from "@playwright/test";
import {
  buildDiagnosticsMockBlueprint,
  installWave2Mocks,
  openBlueprintView,
  seedSupabaseSession,
} from "./wave2-test-helpers.js";

const PROJECT_ID = "proj-wave3-auto-select";

test.describe("Wave 3 inspector auto-select", () => {
  test("architecture pre-selects Application Layer", async ({ page }) => {
    test.setTimeout(60_000);
    await seedSupabaseSession(page);
    await installWave2Mocks(page, PROJECT_ID, "wave3-auto-arch");
    await openBlueprintView(page, "architecture");

    const appLayer = page.getByRole("button", { name: /Application Layer/i });
    await expect(appLayer).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("architecture-inspector")).toBeVisible();
  });

  test("atlas pre-selects the first semantic cluster", async ({ page }) => {
    test.setTimeout(60_000);
    await seedSupabaseSession(page);
    await installWave2Mocks(page, PROJECT_ID, "wave3-auto-atlas");
    await openBlueprintView(page, "atlas");

    await expect(page.getByTestId("atlas-cluster").first()).toHaveAttribute(
      "data-selected",
      "true",
    );
    await expect(page.getByTestId("atlas-inspector")).toBeVisible();
  });

  test("infrastructure pre-selects Web App node", async ({ page }) => {
    test.setTimeout(60_000);
    await seedSupabaseSession(page);
    await installWave2Mocks(page, PROJECT_ID, "wave3-auto-infra");
    await openBlueprintView(page, "infrastructure");

    await expect(
      page
        .getByTestId("infra-topology-node")
        .filter({ hasText: /Web App/i })
        .first(),
    ).toHaveAttribute("data-selected", "true");
  });

  test("diagnostics pre-selects SEC-001", async ({ page }) => {
    test.setTimeout(60_000);
    await seedSupabaseSession(page);
    await installWave2Mocks(
      page,
      PROJECT_ID,
      "wave3-auto-diag",
      buildDiagnosticsMockBlueprint(PROJECT_ID),
    );
    await openBlueprintView(page, "diagnostics");

    await expect(page.getByTestId("problem-inspector-evidence")).toBeVisible({ timeout: 15000 });
    await expect(
      page.getByLabel("Inspektor").getByText("access-control.tenant-isolation-missing"),
    ).toBeVisible();
  });
});
