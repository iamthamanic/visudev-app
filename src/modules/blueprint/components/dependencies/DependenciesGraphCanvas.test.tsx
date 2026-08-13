/**
 * Tests for DependenciesGraphCanvas orphan group overlay (Honest-Core P1-1).
 */

import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DependenciesGraphCanvas } from "./DependenciesGraphCanvas";

vi.mock("../../../../components/GraphCanvas", () => ({
  GraphCanvas: () => <div data-testid="graph-canvas-stub" />,
}));

const searchInputRef = createRef<HTMLInputElement>();

describe("DependenciesGraphCanvas", () => {
  it("renders orphan group with counter", () => {
    render(
      <DependenciesGraphCanvas
        nodes={[
          { id: "file:a", label: "a.ts\nDatei", kind: "file" },
          { id: "file:c", label: "c.ts\nDatei", kind: "file" },
        ]}
        edges={[]}
        totalNodes={2}
        totalEdges={0}
        orphanCount={1}
        orphanNodeIds={["file:c"]}
        selectedNodeId={null}
        searchQuery=""
        searchInputRef={searchInputRef}
        onSearchChange={() => undefined}
        onResetSearch={() => undefined}
        onNodeSelect={() => undefined}
        onEdgeSelect={() => undefined}
        onMinimapSelect={() => undefined}
      />,
    );

    expect(screen.getByTestId("dep-orphan-group")).toHaveTextContent("Ohne Verbindungen (1)");
  });

  it("hides orphan group when count is zero", () => {
    render(
      <DependenciesGraphCanvas
        nodes={[{ id: "file:a", label: "a.ts\nDatei", kind: "file" }]}
        edges={[]}
        totalNodes={1}
        totalEdges={0}
        orphanCount={0}
        orphanNodeIds={[]}
        selectedNodeId={null}
        searchQuery=""
        searchInputRef={searchInputRef}
        onSearchChange={() => undefined}
        onResetSearch={() => undefined}
        onNodeSelect={() => undefined}
        onEdgeSelect={() => undefined}
        onMinimapSelect={() => undefined}
      />,
    );

    expect(screen.queryByTestId("dep-orphan-group")).not.toBeInTheDocument();
  });
});
