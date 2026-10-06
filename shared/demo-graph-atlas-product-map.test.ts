import { describe, expect, it } from "vitest";
import { buildHrToolDemoGraph } from "./demo-graph-seed.js";
import { projectAtlasFromProductUnderstanding } from "../src/modules/blueprint/components/atlas/project-atlas-from-product-understanding.js";

describe("demo atlas product map", () => {
  it("exposes at least three product-area clusters for wave2 E2E", () => {
    const graph = buildHrToolDemoGraph("proj");
    const wired = projectAtlasFromProductUnderstanding(graph);
    expect(wired.groups.length).toBeGreaterThanOrEqual(3);
    expect(wired.nodes.length).toBeGreaterThanOrEqual(3);
  });
});
