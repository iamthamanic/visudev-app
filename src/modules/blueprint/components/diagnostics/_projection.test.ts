import { describe, expect, it } from "vitest";
import type { BlueprintData } from "../../types";
import { DIAGNOSTICS_NOTHING_FOUND, projectDiagnostics } from "./_projection.js";

const blueprint: BlueprintData = {
  version: 1,
  filesAnalyzed: 400,
  totalFiles: 1706,
  routes: [],
  securityMatrix: [],
  findings: [
    {
      id: "finding-1",
      scopeId: "route-1",
      ruleId: "auth.missing",
      severity: "high",
      category: "security",
      message: "Auth fehlt",
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
  graph: {
    version: 1,
    projectId: "p1",
    analyzedAt: "2026-01-01T00:00:00.000Z",
    scopes: [],
    nodes: [
      { id: "file:a", kind: "file", label: "a.ts", metadata: {} },
      { id: "file:b", kind: "file", label: "b.ts", metadata: {} },
    ],
    edges: [
      { id: "e1", kind: "imports", sourceId: "file:a", targetId: "file:b", metadata: {} },
      { id: "e2", kind: "calls", sourceId: "file:b", targetId: "file:a", metadata: {} },
    ],
    evidence: [
      {
        id: "ev-1",
        factId: "fact-1",
        kind: "ast-import",
        filePath: "src/a.ts",
        line: 1,
        excerpt: "import './b'",
      },
    ],
    groups: [{ id: "g1", kind: "module", label: "core", nodeIds: ["file:a", "file:b"] }],
    metrics: [],
    condensed: true,
    limits: { maxNodes: 2500, maxEdges: 5000 },
  },
};

describe("diagnostics projections", () => {
  it("evidence lists graph and finding facts with file and line", () => {
    const projection = projectDiagnostics("evidence", {
      blueprint,
      findings: blueprint.findings ?? [],
      facts: blueprint.facts ?? [],
    });
    expect(projection.rows.length).toBeGreaterThanOrEqual(2);
    expect(projection.rows[0].label).toBe("src/a.ts:1");
    expect(projection.rows.some((row) => row.label === "src/routes/users.ts:10")).toBe(true);
  });

  it("completeness reports partial scan from filesAnalyzed/totalFiles and condensed", () => {
    const projection = projectDiagnostics("completeness", {
      blueprint,
      findings: [],
      facts: [],
    });
    expect(projection.partial).toBe("400 von 1706 Dateien analysiert");
    expect(
      projection.rows.some((row) => row.id === "scope-condensed" && row.detail?.includes("ja")),
    ).toBe(true);
    expect(projection.rows.some((row) => row.id === "scope-files")).toBe(true);
  });

  it("complexity ranks nodes by real edge degree", () => {
    const projection = projectDiagnostics("complexity", {
      blueprint,
      findings: [],
      facts: [],
    });
    expect(projection.rows.length).toBeGreaterThan(0);
    expect(projection.rows[0].detail).toMatch(/eingehend · \d+ ausgehend/);
  });

  it("architecture lists graph groups with edge direction counts", () => {
    const projection = projectDiagnostics("architecture", {
      blueprint,
      findings: [],
      facts: [],
    });
    expect(projection.rows[0].label).toBe("core");
    expect(projection.rows[0].detail).toContain("Knoten");
  });

  it("returns empty rows so the tab can render nothing-found", () => {
    const empty: BlueprintData = {
      version: 1,
      routes: [],
      securityMatrix: [],
      findings: [],
      facts: [],
    };
    expect(
      projectDiagnostics("complexity", { blueprint: empty, findings: [], facts: [] }).rows,
    ).toEqual([]);
    expect(
      projectDiagnostics("architecture", { blueprint: empty, findings: [], facts: [] }).rows,
    ).toEqual([]);
    expect(
      projectDiagnostics("evidence", { blueprint: empty, findings: [], facts: [] }).rows,
    ).toEqual([]);
    expect(
      projectDiagnostics("completeness", { blueprint: empty, findings: [], facts: [] }).rows,
    ).toEqual([]);
    expect(DIAGNOSTICS_NOTHING_FOUND.evidence).toContain("Graph-Evidence");
  });
});
