import { describe, expect, it } from "vitest";
import type { SoftwareGraph } from "../../../shared/software-graph.types.js";
import {
  inferBusinessDomainEntities,
  normalizeBusinessDomainCandidate,
} from "./semantic-domain-inference.js";

function makeGraph(nodes: SoftwareGraph["nodes"]): SoftwareGraph {
  return {
    version: 1,
    projectId: "project-1",
    analyzedAt: "2026-08-15T00:00:00.000Z",
    scopes: [],
    nodes,
    edges: [],
    evidence: [],
    groups: [],
    metrics: [],
    condensed: false,
    limits: { maxNodes: 2500, maxEdges: 8000 },
  };
}

describe("normalizeBusinessDomainCandidate", () => {
  it("merges plural and technical suffix variants", () => {
    expect(normalizeBusinessDomainCandidate("Employees")).toBe("employee");
    expect(normalizeBusinessDomainCandidate("EmployeeService")).toBe("employee");
    expect(normalizeBusinessDomainCandidate("EmployeeServices")).toBe("employee");
    expect(normalizeBusinessDomainCandidate("EmployeeRepositories")).toBe("employee");
    expect(normalizeBusinessDomainCandidate("EmployeeEntities")).toBe("employee");
    expect(normalizeBusinessDomainCandidate("employee-controller")).toBe("employee");
  });

  it("rejects structural technical names", () => {
    for (const name of [
      "components",
      "hooks",
      "screens",
      "services",
      "stores",
      "utils",
      "types",
      "layouts",
      "config",
      "imports",
      "api",
      "worker",
    ]) {
      expect(normalizeBusinessDomainCandidate(name)).toBeNull();
    }
  });
});

describe("inferBusinessDomainEntities", () => {
  it("combines route, table and service evidence into one domain", () => {
    const graph = makeGraph([
      {
        id: "route-employees",
        kind: "route",
        label: "GET /api/employees/:id",
        metadata: { path: "/api/employees/:id" },
      },
      { id: "table-employees", kind: "table", label: "employees", metadata: {} },
      { id: "service-employees", kind: "service", label: "EmployeeService", metadata: {} },
    ]);

    const domains = inferBusinessDomainEntities(graph);
    expect(domains).toHaveLength(1);
    expect(domains[0]).toMatchObject({
      id: "semantic:business-domain:employee",
      kind: "business-domain",
      label: "Employee",
      confidence: 0.98,
      metadata: { sourceKinds: ["route", "service", "table"] },
    });
    expect(domains[0]?.evidence.map((item) => item.refId)).toEqual([
      "route-employees",
      "service-employees",
      "table-employees",
    ]);
  });

  it("does not promote synthetic pipeline service labels", () => {
    const graph = makeGraph([
      { id: "auth-check", kind: "service", label: "auth-check", metadata: {} },
      {
        id: "validation-deny",
        kind: "service",
        label: "validation-deny-400",
        metadata: {},
      },
      { id: "employee-service", kind: "service", label: "EmployeeService", metadata: {} },
    ]);

    expect(inferBusinessDomainEntities(graph).map((domain) => domain.label)).toEqual(["Employee"]);
  });

  it("does not promote folder domains without semantic corroboration", () => {
    const graph = makeGraph([
      { id: "domain-components", kind: "domain", label: "components", metadata: {} },
      { id: "domain-services", kind: "domain", label: "services", metadata: {} },
      { id: "domain-payroll", kind: "domain", label: "payroll", metadata: {} },
    ]);

    expect(inferBusinessDomainEntities(graph)).toEqual([]);
  });

  it("uses a graph domain only to corroborate an existing semantic candidate", () => {
    const graph = makeGraph([
      { id: "domain-payroll", kind: "domain", label: "payroll", metadata: {} },
      {
        id: "route-payroll",
        kind: "route",
        label: "GET /api/payroll/summary",
        metadata: { path: "/api/payroll/summary" },
      },
    ]);

    expect(inferBusinessDomainEntities(graph)).toEqual([
      expect.objectContaining({
        id: "semantic:business-domain:payroll",
        label: "Payroll",
        confidence: 0.95,
        metadata: { candidateKey: "payroll", sourceKinds: ["graph-domain", "route"] },
      }),
    ]);
  });

  it("extracts the first non-technical route resource", () => {
    const graph = makeGraph([
      {
        id: "route-v2",
        kind: "route",
        label: "GET /api/v2/documents/:id",
        metadata: { path: "/api/v2/documents/:id" },
      },
    ]);

    expect(inferBusinessDomainEntities(graph).map((domain) => domain.label)).toEqual(["Document"]);
  });
});
