import { describe, expect, it } from "vitest";
import { buildHrToolDemoGraph } from "../../../../../shared/demo-graph-seed.js";
import { projectInfrastructureGraph } from "./_projection.js";

describe("demo infra projection (RVP-9)", () => {
  it("includes Web App and at least 10 topology-ready entities", () => {
    const graph = buildHrToolDemoGraph("proj");
    const web = graph.nodes.find((node) => node.label === "Web App");
    expect(web?.metadata?.infrastructure).toBe(true);
    const projected = projectInfrastructureGraph(graph);
    expect(projected.nodes.some((node) => node.label === "Web App")).toBe(true);
    expect(projected.nodes.length).toBeGreaterThanOrEqual(10);
  });
});
