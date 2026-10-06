import { describe, expect, it } from "vitest";
import { buildHrToolDemoGraph } from "./demo-graph-seed.js";
import { resolveArchitectureResponsibilityProjection } from "../src/modules/blueprint/components/architecture/resolve-architecture-product-model.js";
import type { BlueprintData } from "../src/modules/blueprint/types.js";

describe("throughput smoke", () => {
  it("tolerates incomplete engine semantic payloads", () => {
    const graph = buildHrToolDemoGraph("proj-pipeline-honest");
    const blueprint = {
      version: 1,
      routes: [],
      securityMatrix: [],
      findings: [],
      facts: [],
      filesAnalyzed: 1,
      semanticSystemModel: {
        entities: [
          { id: "semantic:application:app", kind: "application", label: "App" },
          { id: "semantic:business-domain:hr", kind: "business-domain", label: "HR" },
        ],
        memberships: [],
      },
      graph,
    } as unknown as BlueprintData;
    expect(() => resolveArchitectureResponsibilityProjection(blueprint, graph)).not.toThrow();
    expect(resolveArchitectureResponsibilityProjection(blueprint, graph)?.cards.length).toBeGreaterThan(0);
  });
});
