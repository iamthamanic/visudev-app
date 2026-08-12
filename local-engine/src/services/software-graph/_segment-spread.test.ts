/**
 * Unit tests for segment parent-spread index (P0-13).
 * Location: local-engine/src/services/software-graph/_segment-spread.test.ts
 */

import { describe, expect, it } from "vitest";
import {
  buildSegmentSpreadIndex,
  isDomainCandidate,
  MAX_SPREAD_FOR_DOMAIN,
  MIN_SIBLING_DOMAINS,
} from "./_segment-spread.js";

describe("buildSegmentSpreadIndex", () => {
  it("layer name under many parents has high spread", () => {
    const index = buildSegmentSpreadIndex([
      "app/models/a.rb",
      "app/controllers/a.rb",
      "plugins/x/models/b.rb",
    ]);
    const models = index.byKey.get("models");
    expect(models).toBeDefined();
    expect(models!.parentSpread).toBeGreaterThanOrEqual(2);
  });

  it("domain name under one parent has spread 1", () => {
    const index = buildSegmentSpreadIndex([
      "modules/leaves/x.ts",
      "modules/payroll/y.ts",
      "modules/auth/z.ts",
    ]);
    expect(index.byKey.get("leaves")?.parentSpread).toBe(1);
    expect(index.byKey.get("payroll")?.parentSpread).toBe(1);
    // Under `modules`, each domain sits beside the other two → 2 other siblings.
    expect(index.byKey.get("leaves")?.medianSiblings).toBeGreaterThanOrEqual(2);
    expect(index.byKey.get("modules")?.parentSpread).toBe(1);
  });

  it("case folding: Models and models share a key", () => {
    const index = buildSegmentSpreadIndex([
      "app/Models/a.rb",
      "plugins/x/models/b.rb",
    ]);
    expect(index.byKey.get("models")?.parentSpread).toBe(2);
    expect(index.byKey.has("Models")).toBe(false);
  });

  it("empty input yields empty index", () => {
    const index = buildSegmentSpreadIndex([]);
    expect(index.fileCount).toBe(0);
    expect(index.byKey.size).toBe(0);
  });

  it("index reports label mode for display", () => {
    const index = buildSegmentSpreadIndex([
      "app/Leaves/a.ts",
      "app/Leaves/b.ts",
      "app/leaves/c.ts",
    ]);
    expect(index.byKey.get("leaves")?.label).toBe("Leaves");
  });

  it("isDomainCandidate uses calibrated thresholds", () => {
    const domainLike = {
      key: "leaves",
      label: "leaves",
      parentSpread: 1,
      medianSiblings: 2,
      fileCount: 10,
    };
    const layerLike = {
      key: "models",
      label: "models",
      parentSpread: 4,
      medianSiblings: 3,
      fileCount: 40,
    };
    expect(isDomainCandidate(domainLike)).toBe(true);
    expect(isDomainCandidate(layerLike)).toBe(false);
    expect(MAX_SPREAD_FOR_DOMAIN).toBeGreaterThanOrEqual(1);
    expect(MIN_SIBLING_DOMAINS).toBeGreaterThanOrEqual(2);
  });
});
