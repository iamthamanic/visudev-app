/**
 * Wave 5 shell footer health line gate.
 * Acceptance: .qa/acceptance/wave5-shell-footer-health.md
 */

import { test, expect } from "@playwright/test";
import {
  buildMockBlueprint,
  installWave2Mocks,
  openBlueprintView,
  seedSupabaseSession,
} from "./wave2-test-helpers.js";

const PROJECT_ID = "proj-wave5-footer";

test.describe("Wave 5 shell footer health", () => {
  test("health line and canonical module count persist across blueprint views", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    const blueprint = buildMockBlueprint(PROJECT_ID);
    const expectedModules = blueprint.graph.nodes.filter((node) => node.kind === "module").length;

    await seedSupabaseSession(page);
    await installWave2Mocks(page, PROJECT_ID, "wave5-footer-1", blueprint);
    await openBlueprintView(page, "atlas");

    const health = page.getByTestId("footer-health-line");
    await expect(health).toBeVisible();
    await expect(health).toContainText(/Keine kritischen Probleme/i);

    const moduleCount = page.getByTestId("footer-module-count");
    const atlasModuleText = await moduleCount.innerText();
    expect(Number(atlasModuleText.replace(/[^\d]/g, ""))).toBe(expectedModules);

    await openBlueprintView(page, "diagnostics");
    await expect(page.getByTestId("footer-health-line")).toContainText(
      /Keine kritischen Probleme/i,
    );
    await expect(page.getByTestId("footer-module-count")).toHaveText(atlasModuleText);
  });
});
