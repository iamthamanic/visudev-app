/**
 * E2E critical paths (T2-020): Login screen, Projekt wählen, Scan starten.
 * Run: npx playwright test
 * CI: build + vite preview, then playwright test.
 */

import { test, expect } from "@playwright/test";
import { installWave2Mocks, seedSupabaseSession } from "./wave2-test-helpers.js";

test.describe("VisuDEV critical paths", () => {
  test.beforeEach(async ({ page }) => {
    await seedSupabaseSession(page);
    await installWave2Mocks(page, "proj-critical-paths", "critical-paths-1");
  });

  test("shows login or shell when app loads", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const hasLogin = await page
      .getByRole("heading", { name: /VisuDEV/i })
      .isVisible()
      .catch(() => false);
    const hasSidebar = await page
      .getByRole("navigation")
      .isVisible()
      .catch(() => false);
    const hasMain = await page
      .locator("main")
      .isVisible()
      .catch(() => false);
    expect(hasLogin || (hasSidebar && hasMain)).toBeTruthy();
  });

  test("when logged in, projects screen is reachable", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const nav = page.getByRole("navigation");
    await expect(nav).toBeVisible();
    const projectsLink = page.getByRole("button", {
      name: "Zu Projekte wechseln",
    });
    await expect(projectsLink).toBeVisible();
    await projectsLink.click();
    await expect(page.locator("main")).toBeVisible();
  });

  test("app flow screen shows header or empty state when project selected", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const appFlowNav = page.getByRole("button", {
      name: "Zu App Flow wechseln",
    });
    await expect(appFlowNav).toBeVisible();
    await appFlowNav.click();
    await page.waitForTimeout(500);
    const hasAppFlowTitle = await page
      .getByRole("heading", { name: /App Flow/i })
      .isVisible()
      .catch(() => false);
    const hasEmptyState = await page
      .getByText(/Kein Projekt ausgewählt|Noch keine Flows|Sitemap/i)
      .isVisible()
      .catch(() => false);
    expect(hasAppFlowTitle || hasEmptyState).toBeTruthy();
  });

  test("scan button exists on app flow when project has no data", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const appFlowNav = page.getByRole("button", {
      name: "Zu App Flow wechseln",
    });
    await expect(appFlowNav).toBeVisible();
    await appFlowNav.click();
    await page.waitForTimeout(600);
    await expect(
      page.getByRole("button", {
        name: /Scan starten|Neu analysieren|Analysiere/i,
      }),
    ).toBeVisible();
  });

  test("app flow screen cards show either loaded iframe or clear failure reason (per-screen resilience)", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const appFlowNav = page.getByRole("button", {
      name: "Zu App Flow wechseln",
    });
    await expect(appFlowNav).toBeVisible();
    await appFlowNav.click();
    await page.waitForTimeout(800);
    const liveFlowLabel = page.getByText("Live App Flow");
    const hasLiveFlow = await liveFlowLabel.isVisible().catch(() => false);
    if (!hasLiveFlow) {
      const hasGraphOrSitemap = await page
        .getByText(/Sitemap|Flow Graph|Noch keine Flows|Kein Projekt/i)
        .isVisible()
        .catch(() => false);
      expect(hasGraphOrSitemap).toBeTruthy();
      return;
    }
    const failedCards = page.locator("[data-testid=screen-card-failed]");
    const iframeCards = page.locator("[data-testid=screen-card-iframe]");
    const failedCount = await failedCards.count();
    const iframeCount = await iframeCards.count();
    const totalCards = failedCount + iframeCount;
    if (totalCards === 0) return;
    for (let i = 0; i < failedCount; i++) {
      const card = failedCards.nth(i);
      await expect(card).toBeVisible();
      const reason = card.locator("[data-testid=screen-fail-reason]").first();
      await expect(reason).toContainText(/Timeout|Fehler beim Laden|Keine URL/i);
    }
  });
});
