/**
 * Shared Playwright helpers for Wave 2 viz parity E2E gates.
 * Uses sidebar navigation (pushState) so activeProject survives view switches.
 */

import { expect } from "@playwright/test";
import { buildDemoGitSummary } from "../../shared/demo-git-summary.js";
import { buildHrToolDemoGraph } from "../../shared/demo-graph-seed.js";

export const ENGINE_HOSTS = ["http://127.0.0.1:4317", "http://localhost:4317"];
export const SUPABASE_STORAGE_KEY = "sb-127-auth-token";

export const E2E_USER = {
  id: "e2e-user-id",
  aud: "authenticated",
  role: "authenticated",
  email: "e2e@visudev.test",
  app_metadata: {},
  user_metadata: {},
};

export const E2E_ACCESS_TOKEN =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9." +
  "eyJpc3MiOiJodHRwOi8vMTI3LjAuMC4xOjU0MzIxL2F1dGgvdjEiLCJzdWIiOiJlMmUtdXNlci1pZCIsInJvbGUiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjo5OTk5OTk5OTk5fQ." +
  "e2e-signature";

export function e2eSession() {
  return {
    access_token: E2E_ACCESS_TOKEN,
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: "e2e-refresh",
    user: E2E_USER,
  };
}

export function buildMockProject(projectId: string) {
  return {
    id: projectId,
    name: "browo/hr-tool",
    github_repo: "browo/hr-tool",
    github_branch: "main",
    screens: [],
    flows: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function buildMockBlueprint(projectId: string) {
  return {
    version: 1,
    projectId,
    commitSha: "e9b3c42a",
    analyzedAt: new Date().toISOString(),
    routes: [],
    securityMatrix: [],
    findings: [],
    facts: [],
    filesAnalyzed: 1872,
    graph: buildHrToolDemoGraph(projectId),
  };
}

export function buildMockGitSummary() {
  return buildDemoGitSummary();
}

/** Scaled diagnostics fixture for Wave 3 (5+ matrix rows, ~24 findings). */
export function buildWave3DiagnosticsMock(projectId: string) {
  const routeSpecs = [
    { id: "GET /api/employees", method: "GET", path: "/api/employees" },
    { id: "POST /api/leave-requests", method: "POST", path: "/api/leave-requests" },
    { id: "GET /api/payroll", method: "GET", path: "/api/payroll" },
    { id: "PUT /api/documents/:id", method: "PUT", path: "/api/documents/:id" },
    { id: "DELETE /api/sessions", method: "DELETE", path: "/api/sessions" },
    { id: "GET /api/analytics", method: "GET", path: "/api/analytics" },
  ];

  const routes = routeSpecs.map((spec) => ({
    id: spec.id,
    method: spec.method,
    path: spec.path,
    filePath: `src/routes/${spec.path.replace(/[/:]/g, "-").slice(1)}.ts`,
    line: 8,
    pipeline: [
      { id: "r1", type: "request", label: "Request", state: "confirmed" },
      { id: "r2", type: "auth-gate", label: "Auth", state: "confirmed" },
      { id: "r3", type: "handler", label: "Handler", state: "confirmed" },
    ],
    concepts: { "auth-gate": "confirmed", "validation-gate": "confirmed" },
  }));

  const securityMatrix = routeSpecs.map((spec, index) => ({
    routeId: spec.id,
    method: spec.method,
    path: spec.path,
    auth: { state: index % 3 === 0 ? "missing" : "confirmed" },
    role: { state: index % 4 === 0 ? "partial" : "confirmed" },
    validation: { state: "confirmed" },
    rateLimit: { state: index % 5 === 0 ? "unknown" : "confirmed" },
    db: { state: "confirmed" },
    rls: { state: index === 0 ? "missing" : index % 2 === 0 ? "partial" : "confirmed" },
    audit: { state: index % 3 === 1 ? "partial" : "confirmed" },
    findingCount: index === 0 ? 3 : 1,
  }));

  const cell = (status: "protected" | "missing" | "partial" | "unverified") => ({ status });
  const accessControlMatrix = routeSpecs.map((spec, index) => ({
    routeId: spec.id,
    method: spec.method,
    path: spec.path,
    authentication: cell(index % 3 === 0 ? "missing" : "protected"),
    authorization: cell(index % 4 === 0 ? "partial" : "protected"),
    resourceScope: cell(index % 2 === 0 ? "partial" : "protected"),
    tenantIsolation: cell(index === 0 ? "missing" : "protected"),
    ownership: cell(index % 5 === 0 ? "unverified" : "protected"),
    validation: cell("protected"),
    rateLimit: cell(index % 5 === 0 ? "unverified" : "protected"),
    audit: cell(index % 3 === 1 ? "partial" : "protected"),
    overallStatus: (index === 0 ? "missing" : "partial") as "missing" | "partial",
    findingCount: index === 0 ? 3 : 1,
  }));

  const severities = ["critical", "high", "medium", "low"] as const;
  const findings = Array.from({ length: 24 }, (_, index) => {
    const route = routeSpecs[index % routeSpecs.length];
    const severity = severities[index % severities.length];
    const id = index === 0 ? "SEC-001" : `SEC-${String(index + 1).padStart(3, "0")}`;
    return {
      id,
      ruleId: index === 0 ? "access-control.tenant-isolation-missing" : `rule.${index}`,
      category: "security",
      severity,
      scopeId: route.id,
      message:
        index === 0
          ? "RLS nicht aktiviert – Mitarbeiterdaten für alle sichtbar"
          : `Finding ${id} auf ${route.path}`,
      expectedState: "Compliant",
      actualState: "Abweichung",
      evidenceFactIds: index === 0 ? ["fact-rls"] : [`fact-${index}`],
      confidence: 80 + (index % 15),
      remediation:
        index === 0 ? "Row Level Security auf employees aktivieren." : "Maßnahme prüfen.",
    };
  });

  const facts = [
    {
      id: "fact-rls",
      kind: "db-query",
      filePath: "db/policy.sql",
      line: 4,
      snippet: `-- Aktueller Status
SELECT relname, relrowsecurity
FROM pg_class
WHERE relname = 'employees';

-- Ergebnis
relname   | relrowsecurity
----------+---------------
employees | f`,
      metadata: { table: "employees" },
    },
    ...findings.slice(1).map((finding) => ({
      id: finding.evidenceFactIds[0],
      kind: "code-snippet",
      filePath: `src/routes/${finding.scopeId.replace(/[/ ]/g, "-")}.ts`,
      line: 12,
      snippet: `-- context for ${finding.id}\nSELECT 1;`,
      metadata: {},
    })),
  ];

  const graph = buildHrToolDemoGraph(projectId);

  return {
    version: 1,
    projectId,
    commitSha: "e9b3c42a",
    analyzedAt: new Date().toISOString(),
    routes,
    securityMatrix,
    accessControlMatrix,
    findings,
    facts,
    filesAnalyzed: 1872,
    graph,
  };
}

/** Legacy diagnostics fixture without graph so normalize keeps explicit findings/evidence. */
export function buildDiagnosticsMockBlueprint(projectId: string) {
  return buildWave3DiagnosticsMock(projectId);
}

export async function seedSupabaseSession(page: import("@playwright/test").Page) {
  await page.addInitScript(
    ({ storageKey, session }) => {
      localStorage.setItem(storageKey, JSON.stringify(session));
    },
    { storageKey: SUPABASE_STORAGE_KEY, session: e2eSession() },
  );
}

export async function installWave2Mocks(
  page: import("@playwright/test").Page,
  projectId: string,
  analysisId: string,
  blueprintOverride?: ReturnType<typeof buildMockBlueprint>,
) {
  const MOCK_PROJECT = buildMockProject(projectId);
  const blueprint = blueprintOverride ?? buildMockBlueprint(projectId);

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
        data: { blueprint, analysisId },
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
      url.includes(`/api/projects/${projectId}`) &&
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
        body: JSON.stringify({ ok: true, data: { blueprint, analysisId } }),
      });
      return;
    }

    if (url.includes("/git/summary")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, data: buildMockGitSummary() }),
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

/** Navigate to a Blueprint sub-view; waits for project auto-select after reload. */
export async function openBlueprintView(page: import("@playwright/test").Page, viewId: string) {
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  await expect(page.getByText(/Melde dich an/i)).toBeHidden();

  const projectCard = page.getByText("browo/hr-tool").first();
  await expect(projectCard).toBeVisible({ timeout: 15000 });
  await projectCard.click();

  await page.goto(`/blueprint?view=${viewId}`);
  await page.waitForLoadState("networkidle");

  const emptyProject = page.getByText("Kein Projekt ausgewählt");
  if (await emptyProject.isVisible().catch(() => false)) {
    await expect(emptyProject).toBeHidden({ timeout: 20000 });
  }

  await expect(page.getByTestId("blueprint-view")).toBeVisible({ timeout: 30000 });

  await page
    .getByText("Blueprint wird generiert...")
    .waitFor({ state: "hidden", timeout: 45000 })
    .catch(() => {});
}
