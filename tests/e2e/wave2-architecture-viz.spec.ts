/**
 * Wave 2 architecture viz parity gate — PU-08 responsibility map + Technik stack.
 * Acceptance: .qa/acceptance/wave2-architecture-viz-parity.md + #429
 */

import { test, expect } from "@playwright/test";
import { installWave2Mocks, openBlueprintView, seedSupabaseSession } from "./wave2-test-helpers.js";

const EVIDENCE_DIR = ".qa/evidence/wave2-architecture-viz";
const PROJECT_ID = "proj-wave2-architecture";

test.describe("Wave 2 architecture viz parity", () => {
  test.beforeEach(async ({ page }) => {
    await seedSupabaseSession(page);
    await installWave2Mocks(page, PROJECT_ID, "wave2-architecture-1");
  });

  test("responsibility map by default; Technik shows layer stack", async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await openBlueprintView(page, "architecture");

    await expect(page.getByTestId("architecture-responsibility-map")).toBeVisible({
      timeout: 20000,
    });

    await page.getByTestId("arch-level-select").selectOption("module");
    const stacks = page.getByTestId("architecture-layer-stack");
    await expect(stacks.first()).toBeVisible({ timeout: 20000 });
    expect(await stacks.count()).toBeGreaterThanOrEqual(1);
    await expect(page.getByTestId("layer-card")).toHaveCount(7);

    await page.getByRole("button", { name: /Application Layer/i }).click();
    await expect(page.getByTestId("architecture-inspector")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Enthaltene Services" })).toBeVisible();

    await page.screenshot({
      path: `${EVIDENCE_DIR}/architecture-layer-stack.png`,
      fullPage: false,
    });
  });

  test("domains mode has no duplicate App.tsx entries", async ({ page }) => {
    test.setTimeout(60_000);
    await openBlueprintView(page, "architecture");
    await page.getByTestId("arch-level-select").selectOption("module");

    await page.getByRole("tab", { name: "Domains" }).click();
    const appDuplicates = page.locator('[data-testid="domain-module"][data-path*="App.tsx"]');
    await expect(appDuplicates).toHaveCount(0);
  });
});
