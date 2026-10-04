/**
 * Overlay merge tests — primary topology stays when Security overlays enable.
 */

import { describe, expect, it } from "vitest";
import {
  DEFAULT_VISIBLE_DEPENDENCY_KINDS,
  PRIMARY_TOPOLOGY_EDGE_KINDS,
} from "./_projection.constants.js";
import {
  kindsForOverlays,
  mergeVisibleKindsWithOverlays,
  type DependencyOverlayId,
} from "./dependencies-overlay.js";

describe("dependencies overlays (PR-08)", () => {
  it("defaults exclude auth/validation cross-cutting kinds", () => {
    expect(DEFAULT_VISIBLE_DEPENDENCY_KINDS).toEqual([...PRIMARY_TOPOLOGY_EDGE_KINDS]);
    expect(DEFAULT_VISIBLE_DEPENDENCY_KINDS).not.toContain("auth");
    expect(DEFAULT_VISIBLE_DEPENDENCY_KINDS).not.toContain("validation");
  });

  it("security overlay contributes auth and validation only", () => {
    const kinds = kindsForOverlays(new Set<DependencyOverlayId>(["security"]));
    expect([...kinds].sort()).toEqual(["auth", "validation"]);
  });

  it("merges overlays additively onto primary kinds", () => {
    const merged = mergeVisibleKindsWithOverlays(
      new Set(DEFAULT_VISIBLE_DEPENDENCY_KINDS),
      new Set<DependencyOverlayId>(["security"]),
    );
    expect(merged.has("imports")).toBe(true);
    expect(merged.has("api")).toBe(true);
    expect(merged.has("auth")).toBe(true);
    expect(merged.has("validation")).toBe(true);
  });

  it("does not replace primary when API overlay is active", () => {
    const merged = mergeVisibleKindsWithOverlays(
      new Set(DEFAULT_VISIBLE_DEPENDENCY_KINDS),
      new Set<DependencyOverlayId>(["api"]),
    );
    expect(merged.has("imports")).toBe(true);
    expect(merged.has("data")).toBe(true);
    expect(merged.has("api")).toBe(true);
    expect(merged.has("calls")).toBe(true);
  });
});
