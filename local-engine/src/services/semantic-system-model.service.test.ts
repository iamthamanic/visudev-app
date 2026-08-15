import { describe, expect, it } from "vitest";
import type { SoftwareGraph } from "../../../shared/software-graph.types.js";
import { buildSemanticSystemModel } from "./semantic-system-model.service.js";

function graphFixture(): SoftwareGraph {
  return {
    version: 1,
    projectId: "project-1",
    analyzedAt: "2026-08-15T00:00:00.000Z",
    scopes: [],
    nodes: [
      { id: "app", kind: "application", label: "Web", metadata: {} },
      { id: "domain", kind: "domain", label: "components", metadata: { domainSource: "path" } },
      { id: "service", kind: "service", label: "API", metadata: {} },
      { id: "repo", kind: "repository", label: "HabitRepository", metadata: {} },
      { id: "table", kind: "table", label: "habits", metadata: {} },
      { id: "external", kind: "external", label: "SendGrid", metadata: {} },
      { id: "file", kind: "file", label: "habit.ts", metadata: {} },
    ],
    edges: [
      { id: "contains-service", kind: "contains", sourceId: "app", targetId: "service", metadata: {} },
      { id: "calls-repo", kind: "calls", sourceId: "service", targetId: "repo", metadata: {} },
      { id: "data-table", kind: "data", sourceId: "repo", targetId: "table", metadata: {} },
      { id: "external-call", kind: "api", sourceId: "service", targetId: "external", metadata: {} },
      { id: "file-import", kind: "imports", sourceId: "file", targetId: "service", metadata: {} },
    ],
    evidence: [],
    groups: [],
    metrics: [],
    condensed: false,
    limits: { maxNodes: 2500, maxEdges: 8000 },
  };
}

describe("buildSemanticSystemModel", () => {
  it("is deterministic even when graph input ordering changes", () => {
    const graph = graphFixture();
    const reversed: SoftwareGraph = {
      ...graph,
      nodes: [...graph.nodes].reverse(),
      edges: [...graph.edges].reverse(),
    };

    expect(buildSemanticSystemModel(reversed)).toEqual(buildSemanticSystemModel(graph));
  });

  it("promotes conservative base kinds plus evidence-driven business domains", () => {
    const model = buildSemanticSystemModel(graphFixture());

    expect(model.entities.map((entity) => entity.kind)).toEqual([
      "application",
      "business-domain",
      "component",
      "data-store",
      "external-system",
      "service",
    ]);
    expect(model.entities.every((entity) => entity.evidence.length > 0)).toBe(true);
    expect(model.entities.some((entity) => entity.label === "components")).toBe(false);
    expect(model.entities.some((entity) => entity.label === "Habit")).toBe(true);
    expect(model.entities.some((entity) => entity.label === "habit.ts")).toBe(false);
  });

  it("projects graph relations and an application-to-domain relation", () => {
    const model = buildSemanticSystemModel(graphFixture());

    expect(model.relations.map((relation) => relation.kind)).toEqual([
      "accesses-data",
      "calls",
      "communicates-with",
      "contains",
      "contains",
    ]);
    expect(model.relations.every((relation) => relation.evidence.length > 0)).toBe(true);
    expect(model.relations.some((relation) => relation.evidence[0]?.refId === "file-import")).toBe(false);
    expect(
      model.relations.some(
        (relation) =>
          relation.kind === "contains" && relation.targetId === "semantic:business-domain:habit",
      ),
    ).toBe(true);
  });

  it("returns an empty model for an empty graph", () => {
    const graph = graphFixture();
    graph.nodes = [];
    graph.edges = [];

    expect(buildSemanticSystemModel(graph)).toMatchObject({
      version: 1,
      projectId: "project-1",
      entities: [],
      relations: [],
    });
  });
});
