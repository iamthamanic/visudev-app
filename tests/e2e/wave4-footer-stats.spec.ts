/**
 * Wave 4 footer / stats truth gate.
 * Acceptance: .qa/acceptance/wave4-footer-stats.md
 */

import { test, expect } from "@playwright/test";
import {
  buildMockBlueprint,
  installWave2Mocks,
  openBlueprintView,
  seedSupabaseSession,
} from "./wave2-test-helpers.js";

const PROJECT_ID = "proj-wave4-footer";

test.describe("Wave 4 footer stats", () => {
  test("module and file counts follow canonical graph and scan metrics", async ({ page }) => {
    test.setTimeout(60_000);
    const blueprint = buildMockBlueprint(PROJECT_ID);
    const expectedModules = blueprint.graph.nodes.filter((node) => node.kind === "module").length;
    const expectedFiles = blueprint.filesAnalyzed;

    await seedSupabaseSession(page);
    await installWave2Mocks(page, PROJECT_ID, "wave4-footer-1", blueprint);
    await openBlueprintView(page, "atlas");

    const footer = page.getByTestId("blueprint-footer-stats");
    await expect(footer).toBeVisible();

    const moduleText = await page.getByTestId("footer-module-count").innerText();
    const fileText = await page.getByTestId("footer-file-count").innerText();
    const modules = Number(moduleText.replace(/[^\d]/g, ""));
    const files = Number(fileText.replace(/[^\d]/g, ""));

    expect(modules).toBe(expectedModules);
    expect(files).toBe(expectedFiles);
  });
});
