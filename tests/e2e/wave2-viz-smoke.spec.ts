/**
 * Wave 2 verify-ui smoke: all Blueprint views render non-empty content.
 * Acceptance: .qa/acceptance/wave2-cross-cutting-enrichment.md
 */

import { test, expect } from "@playwright/test";
import { buildHrToolDemoGraph } from "../../shared/demo-graph-seed.js";

const EVIDENCE_DIR = ".qa/evidence/wave2-viz-smoke";
const PROJECT_ID = "proj-wave2-smoke";
const ENGINE_HOSTS = ["http://127.0.0.1:4317", "http://localhost:4317"];
const SUPABASE_STORAGE_KEY = "sb-127-auth-token";

const E2E_USER = {
  id: "e2e-user-id",
  aud: "authenticated",
  role: "authenticated",
  email: "e2e@visudev.test",
  app_metadata: {},
  user_metadata: {},
};

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

const MOCK_PROJECT = {
  id: PROJECT_ID,
  name: "browo/hr-tool",
  github_repo: "browo/hr-tool",
  github_branch: "main",
  screens: [],
  flows: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

function mockBlueprint() {
  const routeId = "POST /api/leave-requests";
  const graph = buildHrToolDemoGraph(PROJECT_ID);

  return {
    version: 1,
    projectId: PROJECT_ID,
    commitSha: "e9b3c42a",
    analyzedAt: new Date().toISOString(),
    routes: [
      {
        id: routeId,
        method: "POST",
        path: "/api/leave-requests",
        filePath: "src/routes/leave.ts",
        line: 12,
        pipeline: [
          { id: "r1", type: "request", label: "LeaveRequestForm", state: "confirmed" },
          { id: "r2", type: "validation-gate", label: "Validation", state: "confirmed" },
          { id: "r3", type: "auth-gate", label: "Auth", state: "confirmed" },
          { id: "r4", type: "handler", label: "CreateLeaveRequest", state: "confirmed" },
        ],
        concepts: {
          "auth-gate": "confirmed",
          "validation-gate": "confirmed",
        },
      },
    ],
    securityMatrix: [
      {
        routeId: "GET /api/employees",
        method: "GET",
        path: "/api/employees",
        auth: { state: "confirmed" },
        role: { state: "partial" },
        validation: { state: "confirmed" },
        rateLimit: { state: "unknown" },
        db: { state: "confirmed" },
        rls: { state: "missing" },
        audit: { state: "partial" },
        findingCount: 1,
      },
    ],
    findings: [
      {
        id: "SEC-001",
        ruleId: "access-control.tenant-isolation-missing",
        category: "security",
        severity: "critical",
        scopeId: "GET /api/employees",
        message: "RLS nicht aktiviert – Mitarbeiterdaten für alle sichtbar",
        expectedState: "RLS aktiv",
        actualState: "RLS fehlt",
        evidenceFactIds: ["fact-rls"],
        confidence: 92,
        remediation: "Row Level Security auf employees aktivieren.",
      },
    ],
    facts: [
      {
        id: "fact-rls",
        kind: "db-query",
        filePath: "db/policy.sql",
        line: 4,
        snippet: "relrowsecurity = false",
        metadata: { table: "employees" },
      },
    ],
    filesAnalyzed: 1872,
    graph,
  };
}

async function seedSupabaseSession(page: import("@playwright/test").Page) {
  await page.addInitScript(
    ({ storageKey, session }) => {
      localStorage.setItem(storageKey, JSON.stringify(session));
    },
    { storageKey: SUPABASE_STORAGE_KEY, session: e2eSession() },
  );
}

async function installMocks(page: import("@playwright/test").Page) {
  const blueprint = mockBlueprint();

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
        data: { blueprint, analysisId: "wave2-smoke-1" },
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

  const localHandler = async (route: import("@playwright/test").Route) => {
    const url = route.request().url();
    const method = route.request().method();

    if (url.includes("/health")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, data: { status: "ok", mode: "local" } }),
      });
      return;
    }

    if (url.endsWith("/api/projects") && method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, data: [MOCK_PROJECT] }),
      });
      return;
    }

    if (
      url.includes(`/api/projects/${PROJECT_ID}`) &&
      method === "GET" &&
      !url.includes("blueprint")
    ) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, data: MOCK_PROJECT }),
      });
      return;
    }

    if (url.includes("/blueprint/latest")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, data: { blueprint, analysisId: "wave2-smoke-1" } }),
      });
      return;
    }

    if (url.includes("/git/summary")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          data: {
            initialized: true,
            commits: [{ sha: "e9b3c42", subject: "Payroll Integration", author: "Lukas Meier" }],
          },
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: {} }),
    });
  };

  for (const host of ENGINE_HOSTS) {
    await page.route(`${host}/**`, localHandler);
  }
}

async function openBlueprintView(page: import("@playwright/test").Page, viewId: string) {
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  await expect(page.getByText(/Melde dich an/i)).toBeHidden();

  const projectCard = page.getByText("browo/hr-tool").first();
  if (await projectCard.isVisible().catch(() => false)) {
    await projectCard.click();
  }

  await page.goto(`/blueprint?view=${viewId}`);
  await page.waitForLoadState("networkidle");

  await page
    .getByText("Blueprint wird generiert...")
    .waitFor({ state: "hidden", timeout: 45000 })
    .catch(() => {});
}

const VIEWS = [
  { id: "architecture", heading: /Architektur/i },
  { id: "dependencies", heading: /Abhängigkeiten/i },
  { id: "execution", heading: /Ausführung/i },
  { id: "infrastructure", heading: /Infrastruktur/i },
  { id: "atlas", heading: /Atlas/i },
  { id: "evolution", heading: /Evolution/i },
  { id: "diagnostics", heading: /Diagnosen/i },
] as const;

test.describe("Wave 2 Blueprint viz smoke", () => {
  test.beforeEach(async ({ page }) => {
    await seedSupabaseSession(page);
    await installMocks(page);
  });

  for (const view of VIEWS) {
    test(`${view.id} view renders non-empty blueprint content`, async ({ page }) => {
      test.setTimeout(60_000);
      await page.setViewportSize({ width: 1440, height: 900 });
      await openBlueprintView(page, view.id);

      await expect(page.getByTestId("blueprint-view")).toBeVisible({ timeout: 20000 });
      const mainContent = page.getByTestId("blueprint-main-content");
      await expect(mainContent).toBeVisible();
      await expect(mainContent).not.toBeEmpty();

      await page.screenshot({
        path: `${EVIDENCE_DIR}/${view.id}.png`,
        fullPage: false,
      });
    });
  }
});
