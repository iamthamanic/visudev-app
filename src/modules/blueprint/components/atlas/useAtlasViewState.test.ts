/**
 * Tests for Atlas view mode — Product Understanding Atlas is 2D-only (PU-07).
 */

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { BlueprintData } from "../../types";
import { useAtlasViewState } from "./useAtlasViewState.js";

const graph: NonNullable<BlueprintData["graph"]> = {
  version: 1,
  projectId: "p1",
  analyzedAt: "2026-01-01T00:00:00.000Z",
  scopes: [],
  nodes: [{ id: "m1", kind: "module", label: "auth", metadata: {} }],
  edges: [],
  evidence: [],
  groups: [],
  metrics: [],
  condensed: false,
  limits: { maxNodes: 2500, maxEdges: 5000 },
};

describe("useAtlasViewState", () => {
  it("defaults to 2d and keeps 3d disabled for Product Understanding Atlas", () => {
    const { result } = renderHook(() => useAtlasViewState(graph));
    expect(result.current.viewMode).toBe("2d");
    expect(result.current.threeDisabled).toBe(true);
  });

  it("blocks manual 3d selection", () => {
    const { result } = renderHook(() => useAtlasViewState(graph));
    act(() => result.current.handleSelectViewMode("3d"));
    expect(result.current.viewMode).toBe("2d");
  });
});
