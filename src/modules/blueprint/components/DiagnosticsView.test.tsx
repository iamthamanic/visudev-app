/**
 * Vitest smoke for Diagnostics sub-tabs, paginated findings table, and Problem-Inspektor.
 */

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DiagnosticsView } from "./DiagnosticsView";
import type { BlueprintData, BlueprintFinding } from "../types";

function makeFinding(index: number): BlueprintFinding {
  return {
    id: `finding-${index}`,
    scopeId: "route-1",
    ruleId: `rule.${index}`,
    severity: index % 2 === 0 ? "high" : "medium",
    category: "security",
    message: `Finding ${index}`,
    expectedState: "required",
    actualState: "missing",
    confidence: 80,
    evidenceFactIds: [`fact-${index}`],
  };
}

const blueprint: BlueprintData = {
  version: 1,
  filesAnalyzed: 1,
  routes: [
    {
      id: "route-1",
      method: "GET",
      path: "/users",
      filePath: "src/routes/users.ts",
      line: 10,
      pipeline: [],
      concepts: {},
    },
  ],
  securityMatrix: [
    {
      routeId: "route-1",
      method: "GET",
      path: "/users",
      auth: { state: "missing" },
      role: { state: "unknown" },
      validation: { state: "confirmed" },
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
      scopeId: "route-1",
      ruleId: "auth.missing",
      severity: "high",
      category: "security",
      message: "Auth fehlt auf Route",
      expectedState: "required",
      actualState: "missing",
      confidence: 90,
      evidenceFactIds: ["fact-1"],
    },
  ],
  facts: [
    {
      id: "fact-1",
      kind: "source",
      filePath: "src/routes/users.ts",
      line: 10,
      snippet: "export async function getUsers() {}",
      metadata: {},
    },
  ],
};

describe("DiagnosticsView", () => {
  beforeEach(() => {
    vi.stubGlobal("navigator", {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders Security sub-tab with matrix and findings by default", () => {
    render(<DiagnosticsView blueprint={blueprint} />);
    expect(screen.getByRole("tab", { name: "Security", selected: true })).toBeInTheDocument();
    expect(screen.getByText("Sicherheits-Matrix")).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "RLS" })).not.toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "DB" })).toBeInTheDocument();
    expect(screen.getAllByText("Auth fehlt auf Route").length).toBeGreaterThan(0);
    expect(screen.getByRole("columnheader", { name: "Schwere" })).toBeInTheDocument();
  });

  it("renders Access Control v2 columns when flag enabled and matrix present", async () => {
    vi.resetModules();
    vi.doMock("../access-control-flag.js", () => ({
      isAccessControlV2Enabled: () => true,
    }));
    const { DiagnosticsView: FlaggedDiagnosticsView } = await import("./DiagnosticsView");
    const acBlueprint: BlueprintData = {
      ...blueprint,
      accessControlMatrix: [
        {
          routeId: "route-1",
          method: "GET",
          path: "/users",
          authentication: { status: "missing" },
          authorization: { status: "unverified" },
          resourceScope: { status: "partial" },
          tenantIsolation: { status: "missing" },
          ownership: { status: "unverified" },
          validation: { status: "protected" },
          rateLimit: { status: "unverified" },
          audit: { status: "unverified" },
          overallStatus: "missing",
          findingCount: 1,
        },
      ],
      accessControlFindings: [
        {
          id: "acf-1",
          resourceId: "route-1",
          resourceKind: "route",
          control: "tenant-isolation",
          status: "missing",
          mechanisms: [{ kind: "database-row-policy", label: "PostgreSQL RLS" }],
          enforcementLayers: ["database"],
          evidence: [
            {
              id: "ev-1",
              kind: "sql",
              filePath: "db/policy.sql",
              line: 4,
              excerpt: "ENABLE ROW LEVEL SECURITY",
            },
          ],
          confidence: 88,
        },
      ],
    };
    render(<FlaggedDiagnosticsView blueprint={acBlueprint} />);
    expect(screen.getByTestId("security-matrix")).toHaveAttribute("data-access-control-v2", "true");
    expect(screen.getByRole("columnheader", { name: "Scope" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Tenant" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Ownership" })).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "RLS" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("ac-matrix-cell-tenantIsolation"));
    expect(screen.getByTestId("access-control-inspector")).toBeInTheDocument();
    expect(screen.getByTestId("ac-mechanisms")).toHaveTextContent("PostgreSQL RLS");
    vi.doUnmock("../access-control-flag.js");
  });

  it("falls back to legacy matrix when accessControlMatrix is absent", async () => {
    vi.resetModules();
    vi.doMock("../access-control-flag.js", () => ({
      isAccessControlV2Enabled: () => true,
    }));
    const { DiagnosticsView: FlaggedDiagnosticsView } = await import("./DiagnosticsView");
    render(<FlaggedDiagnosticsView blueprint={blueprint} />);
    expect(screen.queryByRole("columnheader", { name: "RLS" })).not.toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "DB" })).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Tenant" })).not.toBeInTheDocument();
    vi.doUnmock("../access-control-flag.js");
  });

  it("opens Problem-Inspektor with artifacts and SQL evidence when selecting a finding", async () => {
    render(<DiagnosticsView blueprint={blueprint} />);
    expect(await screen.findByText("Erwartet")).toBeInTheDocument();
    expect(screen.getByText(/getUsers/)).toBeInTheDocument();
    expect(screen.getByText("Verknüpfte Artefakte")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "GET /users" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "src/routes/users.ts:10" })).toBeInTheDocument();
  });

  it("copies evidence from Problem-Inspektor actions", async () => {
    render(<DiagnosticsView blueprint={blueprint} />);
    fireEvent.click(await screen.findByRole("button", { name: "Evidence kopieren" }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      "export async function getUsers() {}",
    );
    expect(await screen.findByRole("button", { name: "Kopiert" })).toBeInTheDocument();
  });

  it("paginates findings table", () => {
    const manyFindings = Array.from({ length: 11 }, (_, index) => makeFinding(index + 1));
    const manyFacts = manyFindings.map((finding) => ({
      id: finding.evidenceFactIds[0],
      kind: "source",
      filePath: `src/routes/file-${finding.id}.ts`,
      line: 1,
      snippet: `snippet ${finding.id}`,
      metadata: {},
    }));

    render(
      <DiagnosticsView
        blueprint={{
          ...blueprint,
          findings: manyFindings,
          facts: manyFacts,
          securityMatrix: [{ ...blueprint.securityMatrix![0], findingCount: 11 }],
        }}
      />,
    );

    expect(screen.getByText("1-5 von 11 Findings")).toBeInTheDocument();
    expect(screen.queryByText("Finding 11")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Weiter" }));
    fireEvent.click(screen.getByRole("button", { name: "Weiter" }));
    expect(screen.getByText("Finding 11")).toBeInTheDocument();
    expect(screen.getByText("11-11 von 11 Findings")).toBeInTheDocument();
  });

  it("marks finding as resolved from Problem-Inspektor", async () => {
    render(<DiagnosticsView blueprint={blueprint} />);
    fireEvent.click(await screen.findByRole("button", { name: "Als erledigt markieren" }));
    expect(screen.getByTestId("finding-status-finding-1")).toHaveTextContent("Erledigt");
  });

  it("switches to a real projection tab", () => {
    render(<DiagnosticsView blueprint={blueprint} />);
    fireEvent.click(screen.getByRole("tab", { name: "Completeness" }));
    const tab = screen.getByTestId("diag-tab-completeness");
    expect(tab).toHaveTextContent("Vollständigkeit");
    expect(tab).toHaveTextContent("Analysierte Dateien");
  });

  it("shows nothing-found for projection tabs without data", () => {
    const empty: BlueprintData = {
      ...blueprint,
      graph: undefined,
      filesAnalyzed: 1,
      findings: [],
      facts: [],
    };
    render(<DiagnosticsView blueprint={empty} />);
    fireEvent.click(screen.getByRole("tab", { name: "Evidence" }));
    expect(screen.getByTestId("diag-tab-evidence")).toHaveTextContent("keine Evidence");
  });
});
