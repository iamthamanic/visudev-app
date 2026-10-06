/**
 * PU-12: Infrastructure system-topology projection tests.
 */
import { describe, expect, it } from "vitest";
import type { ProductUnderstandingModel } from "../product-understanding.types.js";
import { PRODUCT_UNDERSTANDING_MODEL_VERSION } from "../product-understanding.types.js";
import type { SoftwareGraph } from "../software-graph.types.js";
import {
  classifySystemTopologyRole,
  projectInfrastructureSystemTopology,
} from "./project-infrastructure-topology.js";

function sampleModel(): ProductUnderstandingModel {
  return {
    version: PRODUCT_UNDERSTANDING_MODEL_VERSION,
    projectId: "demo",
    analyzedAt: "2026-10-06T00:00:00.000Z",
    concepts: [
      {
        id: "pu:application:leave-app",
        kind: "application",
        label: "Leave App",
        summary: "Urlaubsverwaltung für Mitarbeitende",
        knowledgeStatus: "SUPPORTED",
        confidence: 0.9,
        evidence: [{ source: "software-graph", refId: "app:leave" }],
      },
      {
        id: "pu:system-part:web-client",
        kind: "system-part",
        label: "Web Frontend Client",
        knowledgeStatus: "SUPPORTED",
        confidence: 0.8,
        evidence: [{ source: "software-graph", refId: "svc:web" }],
      },
      {
        id: "pu:system-part:auth-service",
        kind: "system-part",
        label: "Auth Service",
        knowledgeStatus: "SUPPORTED",
        confidence: 0.85,
        evidence: [{ source: "software-graph", refId: "svc:auth" }],
        technicalRefs: [{ source: "software-graph", refId: "svc:auth" }],
      },
      {
        id: "pu:system-part:api",
        kind: "system-part",
        label: "Leave API Backend",
        knowledgeStatus: "INTERPRETED",
        confidence: 0.6,
        evidence: [{ source: "software-graph", refId: "svc:api" }],
      },
      {
        id: "pu:system-part:db",
        kind: "system-part",
        label: "Postgres Database",
        knowledgeStatus: "SUPPORTED",
        confidence: 0.9,
        evidence: [{ source: "software-graph", refId: "table:leaves" }],
      },
      {
        id: "pu:external-system:stripe",
        kind: "external-system",
        label: "Stripe",
        knowledgeStatus: "SUPPORTED",
        confidence: 0.7,
        evidence: [{ source: "software-graph", refId: "ext:stripe" }],
      },
    ],
    relations: [
      {
        id: "rel:auth-api",
        kind: "enables",
        sourceConceptId: "pu:system-part:auth-service",
        targetConceptId: "pu:system-part:api",
        knowledgeStatus: "SUPPORTED",
        confidence: 0.8,
        evidence: [{ source: "software-graph", refId: "edge:auth-api" }],
      },
      {
        id: "rel:api-db",
        kind: "uses",
        sourceConceptId: "pu:system-part:api",
        targetConceptId: "pu:system-part:db",
        knowledgeStatus: "SUPPORTED",
        confidence: 0.8,
        evidence: [{ source: "software-graph", refId: "edge:api-db" }],
      },
      {
        id: "rel:api-stripe",
        kind: "uses",
        sourceConceptId: "pu:system-part:api",
        targetConceptId: "pu:external-system:stripe",
        knowledgeStatus: "SUPPORTED",
        confidence: 0.7,
        evidence: [{ source: "software-graph", refId: "edge:api-stripe" }],
      },
    ],
    impacts: [],
    stories: [],
    dataMeanings: [],
    explanations: [],
  };
}

describe("projectInfrastructureSystemTopology", () => {
  it("projects purpose-first roles and human connection meanings", () => {
    const projection = projectInfrastructureSystemTopology(sampleModel());
    expect(projection.coverage).toBe("partial");
    expect(projection.parts.map((part) => part.role).sort()).toEqual(
      ["application", "auth", "backend", "client", "data", "external"].sort(),
    );
    expect(projection.parts.every((part) => part.purpose.length > 0)).toBe(true);

    const meanings = projection.connections.map((connection) => connection.meaning);
    expect(meanings).toContain("authentifiziert");
    expect(meanings).toContain("speichert");
    expect(meanings).toContain("ruft auf");
  });

  it("attaches technical descriptors only when graph evidence metadata exists", () => {
    const software: SoftwareGraph = {
      version: 1,
      projectId: "demo",
      analyzedAt: "2026-10-06T00:00:00.000Z",
      scopes: [],
      nodes: [
        {
          id: "svc:auth",
          kind: "service",
          label: "Auth Service",
          metadata: {
            runtime: "node",
            region: "eu-central-1",
            provider: "aws",
            env: "prod",
            SECRET_KEY: "must-never-appear",
          },
        },
      ],
      edges: [],
      evidence: [],
      groups: [],
      metrics: [],
      condensed: false,
      limits: { maxNodes: 100, maxEdges: 100 },
    };
    const projection = projectInfrastructureSystemTopology(sampleModel(), { software });
    const auth = projection.parts.find((part) => part.role === "auth");
    expect(auth?.technical).toEqual({
      runtime: "node",
      provider: "aws",
      region: "eu-central-1",
      env: "prod",
    });
    expect(JSON.stringify(auth?.technical)).not.toContain("must-never-appear");
    expect(projection.parts.find((part) => part.role === "client")?.technical).toBeNull();
  });

  it("returns ABSENT coverage when no topology concepts exist", () => {
    const empty = sampleModel();
    empty.concepts = [];
    empty.relations = [];
    const projection = projectInfrastructureSystemTopology(empty);
    expect(projection.coverage).toBe("absent");
    expect(projection.parts).toHaveLength(0);
  });

  it("classifies roles without inventing taxonomy members", () => {
    expect(
      classifySystemTopologyRole({
        id: "x",
        kind: "system-part",
        label: "OpenAI Embeddings",
        knowledgeStatus: "SUPPORTED",
        confidence: 1,
        evidence: [{ source: "software-graph", refId: "ai:1" }],
      }),
    ).toBe("ai");
  });
});
