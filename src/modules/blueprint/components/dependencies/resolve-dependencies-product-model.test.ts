/**
 * Incomplete engine semanticSystemModel must not crash Dependencies impact projection.
 */
import { describe, expect, it } from "vitest";
import { buildHrToolDemoGraph } from "../../../../../shared/demo-graph-seed.js";
import type { BlueprintData } from "../../types.js";
import { resolveDependenciesImpactProjection } from "./resolve-dependencies-product-model.js";

describe("resolveDependenciesImpactProjection", () => {
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
    expect(() => resolveDependenciesImpactProjection(blueprint, graph)).not.toThrow();
    const projection = resolveDependenciesImpactProjection(blueprint, graph);
    expect(projection).not.toBeNull();
    expect(Array.isArray(projection?.nodes)).toBe(true);
    expect(Array.isArray(projection?.relations)).toBe(true);
  });
});
