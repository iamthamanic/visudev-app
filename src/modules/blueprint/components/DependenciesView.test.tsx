/**
 * Tests for DependenciesView empty state and edge filters.
 */

import { render, screen, fireEvent, within } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { DependenciesView } from "./DependenciesView";
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
      { id: "file:a", kind: "file", label: "a.ts", metadata: {} },
      { id: "file:b", kind: "file", label: "b.ts", metadata: {} },
    ],
    edges: [
      {
        id: "e-import",
        kind: "imports",
        sourceId: "file:a",
        targetId: "file:b",
        metadata: { evidenceFactId: "fact-1" },
      },
      {
        id: "e-call",
        kind: "calls",
        sourceId: "file:b",
        targetId: "file:a",
        metadata: { evidenceFactId: "fact-2" },
      },
    ],
    evidence: [
      {
        id: "ev-1",
        factId: "fact-1",
        kind: "ast-import",
        filePath: "src/a.ts",
        line: 1,
        excerpt: "import './b'",
      },
    ],
    groups: [],
    metrics: [],
    condensed: false,
    limits: { maxNodes: 2500, maxEdges: 5000 },
  },
};

describe("DependenciesView", () => {
  it("shows empty state without graph", () => {
    render(<DependenciesView blueprint={emptyBlueprint} />);
    expect(screen.getByText("Keine Abhängigkeits-Daten")).toBeInTheDocument();
  });

  it("renders Beziehungstypen relationship chips", () => {
    render(<DependenciesView blueprint={graphBlueprint} />);
    const controls = screen.getByLabelText("Abhängigkeiten-Steuerung");
    expect(within(controls).getByRole("button", { name: "Imports" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(within(controls).getByRole("button", { name: "Calls" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("disables relationship chips that have no edges in the current graph (P0-3)", () => {
    render(<DependenciesView blueprint={graphBlueprint} />);
    const controls = screen.getByLabelText("Abhängigkeiten-Steuerung");
    const database = within(controls).getByRole("button", { name: "Database" });
    expect(database).toBeDisabled();
    expect(screen.getByTestId("dep-chip-data")).toBeInTheDocument();
    expect(
      screen.getAllByLabelText(/Keine Database-Kanten im aktuellen Scan/).length,
    ).toBeGreaterThan(0);
  });

  it("shows Top Abhängigkeiten counts", () => {
    render(<DependenciesView blueprint={graphBlueprint} />);
    const controls = screen.getByLabelText("Abhängigkeiten-Steuerung");
    expect(within(controls).getByText("Top Abhängigkeiten")).toBeInTheDocument();
    expect(within(controls).getAllByText("1").length).toBeGreaterThanOrEqual(2);
  });

  it("shows inspector with node details when graph has use-case hub", () => {
    render(<DependenciesView blueprint={graphBlueprint} />);
    expect(screen.getByTestId("dependency-inspector")).toBeInTheDocument();
  });

  it("shows empty canvas message when all relationship chips are off", () => {
    render(<DependenciesView blueprint={graphBlueprint} />);
    const controls = screen.getByLabelText("Abhängigkeiten-Steuerung");
    for (const label of [
      "Imports",
      "Calls",
      "API Calls",
      "Events",
      "Database",
      "Auth",
      "Validation",
      "External Services",
    ]) {
      const chip = within(controls).getByRole("button", { name: label });
      if (chip.getAttribute("aria-pressed") === "true") {
        fireEvent.click(chip);
      }
    }
    expect(screen.getByText(/Passe die Beziehungstypen an/i)).toBeInTheDocument();
  });

  it("renders graph search, footer stats, and minimap", () => {
    render(<DependenciesView blueprint={graphBlueprint} />);
    expect(screen.getByPlaceholderText(/Label oder Modul/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Graph-Statistik")).toBeInTheDocument();
    expect(screen.getByLabelText("Graph-Minimap")).toBeInTheDocument();
    expect(screen.getByText(/2\/2 Knoten sichtbar/i)).toBeInTheDocument();
  });

  it("shows top dependencies in inspector when no edge selected", () => {
    render(<DependenciesView blueprint={graphBlueprint} />);
    expect(screen.getAllByText("Top Abhängigkeiten").length).toBeGreaterThan(0);
  });

  it("filters graph via search input", () => {
    render(<DependenciesView blueprint={graphBlueprint} />);
    fireEvent.change(screen.getByPlaceholderText(/Label oder Modul/i), {
      target: { value: "b.ts" },
    });
    expect(screen.getByText(/2\/2 Knoten sichtbar/i)).toBeInTheDocument();
  });
});
