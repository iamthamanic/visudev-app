/**
 * Tests for infrastructure topology node classification.
 */

import { describe, it, expect } from "vitest";
import {
  buildTopologyNodes,
  classifyGraphNodeTopologyTier,
  deploymentFiltersFromGraph,
  filterProjectedNodesByDeployment,
  projectPhysicalTopology,
} from "./build-topology.js";
import type { GraphCanvasNode } from "../../types";
import type { SoftwareGraph } from "../../types";

describe("build-topology", () => {
  it("classifies infrastructure tiers", () => {
    expect(classifyGraphNodeTopologyTier({ id: "1", label: "Internet", kind: "runtime" })).toBe(
      "internet",
    );
    expect(
      classifyGraphNodeTopologyTier({ id: "2", label: "LOAD BALANCER / GATEWAY", kind: "runtime" }),
    ).toBe("loadBalancer");
    expect(classifyGraphNodeTopologyTier({ id: "3", label: "Web App", kind: "service" })).toBe(
      "service",
    );
    expect(classifyGraphNodeTopologyTier({ id: "4", label: "PostgreSQL", kind: "table" })).toBe(
      "database",
    );
    expect(
      classifyGraphNodeTopologyTier({ id: "5", label: "Payment API (Stripe)", kind: "external" }),
    ).toBe("externalApi");
    expect(classifyGraphNodeTopologyTier({ id: "6", label: "Prometheus", kind: "external" })).toBe(
      "monitoring",
    );
    expect(classifyGraphNodeTopologyTier({ id: "7", label: "symbol", kind: "symbol" })).toBeNull();
  });

  it("maps Softort scan nodes (routes/runtimes/tables) into topology tiers", () => {
    expect(
      classifyGraphNodeTopologyTier({ id: "r1", label: "GET /app/health", kind: "route" }),
    ).toBe("service");
    expect(classifyGraphNodeTopologyTier({ id: "rt1", label: "server", kind: "runtime" })).toBe(
      "service",
    );
    expect(classifyGraphNodeTopologyTier({ id: "t1", label: "Survey", kind: "table" })).toBe(
      "database",
    );
  });

  it("projects graph nodes without injecting synthetic topology nodes", () => {
    const projectedGraphNodes: GraphCanvasNode[] = [
      { id: "runtime:internet", label: "Internet", kind: "runtime" },
      { id: "runtime:lb", label: "LOAD BALANCER / GATEWAY", kind: "runtime" },
      { id: "service:web", label: "Web App", kind: "service" },
      { id: "service:api", label: "API Service", kind: "service" },
      { id: "service:worker", label: "Worker", kind: "service" },
      { id: "service:auth", label: "Auth Service", kind: "service" },
      { id: "table:pg", label: "PostgreSQL", kind: "table" },
      { id: "table:redis", label: "Redis", kind: "table" },
      { id: "table:storage", label: "STORAGE", kind: "table" },
      { id: "external:stripe", label: "Payment API (Stripe)", kind: "external" },
      { id: "external:sso", label: "SSO (OIDC)", kind: "external" },
      { id: "external:hr-data", label: "HR Datenanbieter", kind: "external" },
      { id: "external:monitor", label: "Prometheus", kind: "external" },
      { id: "external:grafana", label: "Grafana", kind: "external" },
    ];
    const topologyRefs = buildTopologyNodes(projectedGraphNodes);
    expect(topologyRefs).toHaveLength(projectedGraphNodes.length);
    expect(
      topologyRefs.some((node) => node.tier === "monitoring" && node.label === "Grafana"),
    ).toBe(true);
    expect(
      topologyRefs.some((node) => node.tier === "externalApi" && node.label === "HR Datenanbieter"),
    ).toBe(true);
  });

  it("filters projected nodes by deployment metadata", () => {
    const projectedGraphNodes: GraphCanvasNode[] = [
      { id: "service:web", label: "Web App", kind: "service" },
      { id: "service:staging", label: "Staging API", kind: "service" },
    ];
    const softwareGraph: SoftwareGraph = {
      version: 1,
      projectId: "proj-test",
      analyzedAt: new Date().toISOString(),
      scopes: [],
      nodes: [
        {
          id: "service:web",
          kind: "service",
          label: "Web App",
          metadata: { env: "prod", region: "eu-central-1" },
        },
        {
          id: "service:staging",
          kind: "service",
          label: "Staging API",
          metadata: { env: "staging", region: "eu-central-1" },
        },
      ],
      edges: [],
      evidence: [],
      groups: [],
      metrics: [],
      condensed: false,
      limits: { maxNodes: 100, maxEdges: 100 },
      snapshots: [],
    };

    const filtered = filterProjectedNodesByDeployment(
      projectedGraphNodes,
      softwareGraph,
      "prod",
      "eu-central-1",
    );
    expect(filtered.map((node) => node.id)).toEqual(["service:web"]);
  });

  it("derives env/region filters from real node metadata only", () => {
    const softwareGraph: SoftwareGraph = {
      version: 1,
      projectId: "proj-test",
      analyzedAt: new Date().toISOString(),
      scopes: [],
      nodes: [
        { id: "a", kind: "service", label: "A", metadata: { env: "prod", region: "eu-central-1" } },
        { id: "b", kind: "service", label: "B", metadata: { env: "staging" } },
        { id: "c", kind: "service", label: "C", metadata: {} },
      ],
      edges: [],
      evidence: [],
      groups: [],
      metrics: [],
      condensed: false,
      limits: { maxNodes: 100, maxEdges: 100 },
      snapshots: [],
    };
    const filters = deploymentFiltersFromGraph(softwareGraph);
    expect(filters.envs).toEqual(["prod", "staging"]);
    expect(filters.regions).toEqual(["eu-central-1"]);
  });

  it("returns empty env/region filters when no node carries deployment metadata", () => {
    const softwareGraph: SoftwareGraph = {
      version: 1,
      projectId: "proj-test",
      analyzedAt: new Date().toISOString(),
      scopes: [],
      nodes: [{ id: "a", kind: "service", label: "A", metadata: {} }],
      edges: [],
      evidence: [],
      groups: [],
      metrics: [],
      condensed: false,
      limits: { maxNodes: 100, maxEdges: 100 },
      snapshots: [],
    };
    const filters = deploymentFiltersFromGraph(softwareGraph);
    expect(filters.envs).toEqual([]);
    expect(filters.regions).toEqual([]);
  });

  it("projects physical topology from compose service nodes (AUF-3)", () => {
    const softwareGraph: SoftwareGraph = {
      version: 1,
      projectId: "proj-test",
      analyzedAt: new Date().toISOString(),
      scopes: [],
      nodes: [
        {
          id: "deploy:compose:api",
          kind: "service",
          label: "api",
          metadata: {
            source: "docker-compose",
            env: "shop",
            ports: "3000:3000",
            networks: "frontend,backend",
          },
        },
        {
          id: "deploy:compose:db",
          kind: "service",
          label: "db",
          metadata: {
            source: "docker-compose",
            env: "shop",
            ports: "5432:5432",
            networks: "backend",
          },
        },
      ],
      edges: [
        {
          id: "e-dep",
          kind: "external-dependency",
          sourceId: "deploy:compose:api",
          targetId: "deploy:compose:db",
          metadata: { relation: "depends-on" },
        },
      ],
      evidence: [],
      groups: [],
      metrics: [],
      condensed: false,
      limits: { maxNodes: 100, maxEdges: 100 },
      snapshots: [],
    };
    const visible = new Set(softwareGraph.nodes.map((node) => node.id));
    const physical = projectPhysicalTopology(softwareGraph, visible);
    expect(physical).not.toBeNull();
    expect(physical?.sourceLabel).toBe("Quelle: Docker Compose");
    expect(physical?.nodes.map((node) => node.id)).toEqual([
      "deploy:compose:api",
      "deploy:compose:db",
    ]);
    expect(physical?.networks.map((network) => network.name)).toEqual(["backend", "frontend"]);
    expect(physical?.dependencies).toHaveLength(1);
  });

  it("returns no physical topology without compose/k8s descriptors", () => {
    const softwareGraph: SoftwareGraph = {
      version: 1,
      projectId: "proj-test",
      analyzedAt: new Date().toISOString(),
      scopes: [],
      nodes: [{ id: "a", kind: "service", label: "A", metadata: {} }],
      edges: [],
      evidence: [],
      groups: [],
      metrics: [],
      condensed: false,
      limits: { maxNodes: 100, maxEdges: 100 },
      snapshots: [],
    };
    expect(projectPhysicalTopology(softwareGraph, new Set(["a"]))).toBeNull();
  });
});
