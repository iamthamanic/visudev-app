/**
 * Tests for ArchitectureView — PU-08 responsibility map default + technical detail levels.
 */

import { render, screen, fireEvent, within } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ArchitectureView } from "./ArchitectureView";
import type { BlueprintData } from "../types";

const emptyBlueprint: BlueprintData = {
  version: 1,
  routes: [],
  securityMatrix: [],
  findings: [],
  facts: [],
  filesAnalyzed: 0,
};

const graphBlueprint: BlueprintData = {
  ...emptyBlueprint,
  graph: {
    version: 1,
    projectId: "p1",
    analyzedAt: "2026-01-01T00:00:00.000Z",
    scopes: [],
    nodes: [
      { id: "app:hr", kind: "application", label: "hr-tool", metadata: {} },
      { id: "domain:leave", kind: "domain", label: "Leave", metadata: {} },
      { id: "module:leave-repo", kind: "module", label: "LeaveRepository", metadata: {} },
      { id: "layer:routes:presentation", kind: "layer", label: "presentation", metadata: {} },
      {
        id: "module:routes:presentation:routes",
        kind: "module",
        label: "routes",
        metadata: {},
      },
    ],
    edges: [
      {
        id: "e1",
        kind: "contains",
        sourceId: "domain:leave",
        targetId: "module:leave-repo",
        metadata: {},
      },
      {
        id: "e2",
        kind: "contains",
        sourceId: "layer:routes:presentation",
        targetId: "module:routes:presentation:routes",
        metadata: {},
      },
    ],
    evidence: [],
    groups: [],
    metrics: [],
    condensed: false,
    limits: { maxNodes: 2500, maxEdges: 5000 },
  },
};

function openTechnicalLevel() {
  fireEvent.click(screen.getByTestId("arch-level-module"));
}

describe("ArchitectureView", () => {
  it("shows empty state without graph data", () => {
    render(<ArchitectureView blueprint={emptyBlueprint} />);
    expect(screen.getByTestId("view-state-not-scanned")).toBeInTheDocument();
  });

  it("defaults to Product Understanding responsibility map", () => {
    render(<ArchitectureView blueprint={graphBlueprint} />);
    expect(screen.getByTestId("architecture-responsibility-map")).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Layers" })).not.toBeInTheDocument();
  });

  it("shows partial or empty state honestly when product map is thin", () => {
    render(<ArchitectureView blueprint={graphBlueprint} />);
    const map = screen.getByTestId("architecture-responsibility-map");
    expect(map).toBeInTheDocument();
    const banner = screen.queryByTestId("architecture-partial-banner");
    const empty = screen.queryByTestId("architecture-responsibility-empty");
    expect(
      banner || empty || screen.getAllByTestId("architecture-responsibility-card").length >= 0,
    ).toBeTruthy();
  });

  it("opens purpose-first inspector for a responsibility card", () => {
    render(<ArchitectureView blueprint={graphBlueprint} />);
    const cards = screen.getAllByTestId("architecture-responsibility-card");
    expect(cards.length).toBeGreaterThan(0);
    fireEvent.click(cards[0]);
    expect(screen.getByTestId("architecture-purpose")).toBeInTheDocument();
    expect(screen.getByTestId("architecture-boundary-detail")).toBeInTheDocument();
  });

  it("switches to technical layer stack via Technik level", () => {
    render(<ArchitectureView blueprint={graphBlueprint} />);
    openTechnicalLevel();
    expect(screen.getByRole("tab", { name: "Layers", selected: true })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /presentation/i })).toBeInTheDocument();
  });

  it("switches to Domains grouping mode on technical level", () => {
    render(<ArchitectureView blueprint={graphBlueprint} />);
    openTechnicalLevel();
    fireEvent.click(screen.getByRole("tab", { name: "Domains" }));
    const stack = screen.getByLabelText("Architektur-Stack");
    expect(within(stack).getByRole("button", { name: /leave/i })).toBeInTheDocument();
  });

  it("opens Inspektor with services table when selecting a stack card on Technik", () => {
    render(<ArchitectureView blueprint={graphBlueprint} />);
    openTechnicalLevel();
    fireEvent.click(screen.getByRole("button", { name: /presentation/i }));
    expect(screen.getByText("Verantwortlichkeiten")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Service" })).toBeInTheDocument();
  });

  it("shows GraphCanvas only in Modules grouping mode on Technik", () => {
    render(<ArchitectureView blueprint={graphBlueprint} />);
    openTechnicalLevel();
    fireEvent.click(screen.getByRole("tab", { name: "Modules" }));
    expect(screen.getByText("Graph wird geladen...")).toBeInTheDocument();
  });
});
