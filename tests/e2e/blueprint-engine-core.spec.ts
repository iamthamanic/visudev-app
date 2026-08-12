/**
 * Verify-UI: Blueprint Engine Core
 * Acceptance: .qa/acceptance/blueprint-engine-core.md
 * Evidence: .qa/evidence/blueprint-engine-core/
 */

import { test, expect } from "@playwright/test";

const EVIDENCE_DIR = ".qa/evidence/blueprint-engine-core";

const MOCK_PROJECT = {
  id: "proj-blueprint-e2e",
  name: "Blueprint E2E",
  github_repo: "owner/demo-app",
  github_branch: "main",
  screens: [],
  flows: [],
  createdAt: new Date().toISOString(),
};

const SUPABASE_STORAGE_KEY = "sb-127-auth-token";

const E2E_USER = {
  id: "e2e-user-id",
  aud: "authenticated",
  role: "authenticated",
  email: "e2e@visudev.test",
  app_metadata: {},
  user_metadata: {},
};

/** Minimal JWT so AuthContext issuer check accepts local Supabase. */
const E2E_ACCESS_TOKEN =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9." +
  "eyJpc3MiOiJodHRwOi8vMTI3LjAuMC4xOjU0MzIxL2F1dGgvdjEiLCJzdWIiOiJlMmUtdXNlci1pZCIsInJvbGUiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjo5OTk5OTk5OTk5fQ." +
  "e2e-signature";

function e2eSession() {
  return {
    access_token: E2E_ACCESS_TOKEN,
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: "e2e-refresh",
    user: E2E_USER,
  };
}

function mockBlueprintDoc() {
  const routeId = "POST /api/employees";
  return {
    version: 1,
    projectId: MOCK_PROJECT.id,
    commitSha: "abc12345",
    analyzedAt: new Date().toISOString(),
    routes: [
      {
        id: routeId,
        method: "POST",
        path: "/api/employees",
        filePath: "src/routes/employees.ts",
        line: 12,
        pipeline: [
          { id: "r1", type: "request", label: "Request", state: "confirmed" },
          { id: "r2", type: "auth-gate", label: "Auth", state: "partial" },
          { id: "r3", type: "validation-gate", label: "Validation", state: "missing" },
          { id: "r4", type: "handler", label: "Handler", state: "confirmed" },
          { id: "r5", type: "db-write", label: "DB", state: "confirmed" },
        ],
        concepts: {
          "auth-gate": "partial",
          "validation-gate": "missing",
          "db-write": "confirmed",
        },
      },
    ],
    securityMatrix: [
      {
        routeId,
        method: "POST",
        path: "/api/employees",
        auth: { state: "partial" },
        role: { state: "unknown" },
        validation: { state: "missing" },
        rateLimit: { state: "unknown" },
        db: { state: "confirmed" },
        rls: { state: "unknown" },
        audit: { state: "unknown" },
        findingCount: 1,
      },
    ],
    findings: [
      {
        id: "finding-1",
        ruleId: "web-api.validation-before-db-write",
        category: "security",
        severity: "high",
        scopeId: routeId,
        message: "Runtime Validation fehlt vor DB Write.",
        expectedState: "Validation Gate confirmed vor DB Write",
        actualState: "Validation Gate missing",
        evidenceFactIds: ["fact-1"],
        confidence: 87,
        remediation: "Zod safeParse auf Request anwenden.",
      },
    ],
    facts: [
      {
        id: "fact-1",
        kind: "db-write",
        filePath: "src/routes/employees.ts",
        line: 18,
        snippet: "await supabase.from('employees').insert(data)",
        metadata: { table: "employees", operation: "insert" },
      },
    ],
    filesAnalyzed: 42,
    frameworkHints: ["hono", "supabase"],
  };
}

async function installMocks(page: import("@playwright/test").Page) {
  const blueprint = mockBlueprintDoc();

  await page.route("**/functions/v1/visudev-projects**", async (route) => {
    const url = route.request().url();
    if (route.request().method() === "GET" && !url.includes("/proj-")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: [MOCK_PROJECT] }),
      });
      return;
    }
    if (url.includes(MOCK_PROJECT.id)) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: MOCK_PROJECT }),
      });
      return;
    }
    await route.continue();
  });

  await page.route("**/functions/v1/visudev-blueprint/**", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: blueprint }),
      });
      return;
    }
    if (route.request().method() === "PUT") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: blueprint }),
      });
      return;
    }
    await route.continue();
  });

  await page.route("**/functions/v1/visudev-analyzer/blueprint/analyze**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: { blueprint, analysisId: "analysis-e2e-1" },
      }),
    });
  });

  await page.route("**/auth/v1/**", async (route) => {
    const url = route.request().url();
    const method = route.request().method();

    if (url.includes("/token") && method === "POST") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(e2eSession()),
      });
      return;
    }

    if (url.includes("/user")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(E2E_USER),
      });
      return;
    }

    await route.continue();
  });
}

async function seedSupabaseSession(page: import("@playwright/test").Page) {
  await page.addInitScript(
    ({ storageKey, session }) => {
      localStorage.setItem(storageKey, JSON.stringify(session));
    },
    { storageKey: SUPABASE_STORAGE_KEY, session: e2eSession() },
  );
}

test.describe("Blueprint Engine Core UI", () => {
  test.beforeEach(async ({ page }) => {
    await seedSupabaseSession(page);
    await installMocks(page);
  });

  test("blueprint page shows security matrix and route canvas", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const loginSubtitle = page.getByText(/Melde dich an/i);
    await expect(loginSubtitle).toBeHidden();

    const projectCard = page.getByText("Blueprint E2E").first();
    if (await projectCard.isVisible().catch(() => false)) {
      await projectCard.click();
    }

    const blueprintNav = page.getByRole("button", { name: /Blueprint/i });
    await expect(blueprintNav).toBeVisible({ timeout: 10000 });
    await blueprintNav.click();

    await expect(
      page.locator("header").getByText("Blueprint", { exact: true }).first(),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Diagnosen" })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Sicherheits-Matrix/i })).toBeVisible({
      timeout: 15000,
    });

    await page.screenshot({
      path: `${EVIDENCE_DIR}/01-blueprint-matrix.png`,
      fullPage: true,
    });

    const routeButton = page.getByRole("button", { name: /\/api\/employees/i });
    await expect(routeButton).toBeVisible();
    await routeButton.click();

    await expect(page.getByRole("heading", { name: /POST \/api\/employees/i })).toBeVisible();
    const routeCanvas = page.getByRole("region", { name: /POST \/api\/employees/i });
    await expect(routeCanvas.getByText("Validation", { exact: true })).toBeVisible();
    await expect(routeCanvas.getByText("Fehlt", { exact: true })).toBeVisible();

    await page.screenshot({
      path: `${EVIDENCE_DIR}/02-route-canvas.png`,
      fullPage: true,
    });
  });

  test("finding inspector shows rule and evidence", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText(/Melde dich an/i)).toBeHidden();

    const projectCard = page.getByText("Blueprint E2E").first();
    if (await projectCard.isVisible().catch(() => false)) {
      await projectCard.click();
    }

    await page.getByRole("button", { name: /Blueprint/i }).click();
    await expect(page.getByRole("heading", { name: "Diagnosen" })).toBeVisible({
      timeout: 15000,
    });
    const inspector = page.getByLabel("Inspektor");
    if (
      !(await inspector
        .getByText("web-api.validation-before-db-write")
        .isVisible()
        .catch(() => false))
    ) {
      await page
        .getByRole("button", { name: /Runtime Validation fehlt vor DB Write/i })
        .first()
        .click();
    }
    await expect(inspector.getByText("web-api.validation-before-db-write")).toBeVisible({
      timeout: 15000,
    });
    await expect(inspector.getByRole("link", { name: "src/routes/employees.ts:18" })).toBeVisible();

    await page.screenshot({
      path: `${EVIDENCE_DIR}/03-finding-inspector.png`,
      fullPage: true,
    });
  });

  test("blueprint sidebar switches between Infrastruktur and Diagnosen views", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText(/Melde dich an/i)).toBeHidden();

    const projectCard = page.getByText("Blueprint E2E").first();
    if (await projectCard.isVisible().catch(() => false)) {
      await projectCard.click();
    }

    await page.getByRole("button", { name: /Blueprint/i }).click();
    await expect(page.getByRole("heading", { name: "Diagnosen" })).toBeVisible();

    await page.getByRole("button", { name: "Infrastruktur", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Infrastruktur" })).toBeVisible();

    await page.getByRole("button", { name: "Diagnosen", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Diagnosen" })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Sicherheits-Matrix/i })).toBeVisible();
  });

  test("empty blueprint shows no routes message", async ({ page }) => {
    const emptyBlueprint = {
      routes: [],
      securityMatrix: [],
      findings: [],
      facts: [],
    };

    await page.route("**/functions/v1/visudev-blueprint/**", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true, data: emptyBlueprint }),
        });
        return;
      }
      if (route.request().method() === "PUT") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true, data: emptyBlueprint }),
        });
        return;
      }
      await route.continue();
    });

    await page.route("**/functions/v1/visudev-analyzer/blueprint/analyze**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            blueprint: emptyBlueprint,
            analysisId: "empty",
          },
        }),
      });
    });

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText(/Melde dich an/i)).toBeHidden();

    const projectCard = page.getByText("Blueprint E2E").first();
    if (await projectCard.isVisible().catch(() => false)) {
      await projectCard.click();
    }

    await page.getByRole("button", { name: /Blueprint/i }).click();
    await expect(page.getByRole("heading", { name: "Diagnosen" })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/Keine API-Routes erkannt|Keine Blueprint-Daten/i)).toBeVisible({
      timeout: 20000,
    });

    await page.screenshot({
      path: `${EVIDENCE_DIR}/04-empty-blueprint.png`,
      fullPage: true,
    });
  });
});
