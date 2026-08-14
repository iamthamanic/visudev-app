/**
 * Tests for EvolutionView sub-tabs, snapshot cards, and compare controls.
 */

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { EvolutionView } from "./EvolutionView";
import type { BlueprintData } from "../types";

const graphWithSnapshots: BlueprintData = {
  version: 1,
  routes: [],
  securityMatrix: [],
  findings: [],
  facts: [],
  filesAnalyzed: 0,
  graph: {
    version: 1,
    projectId: "p1",
    analyzedAt: "2026-01-01T00:00:00.000Z",
    scopes: [],
    nodes: [
      { id: "a", kind: "file", label: "a.ts", metadata: {} },
      { id: "b", kind: "file", label: "b.ts", metadata: {} },
    ],
    edges: [],
    evidence: [],
    groups: [],
    metrics: [],
    condensed: false,
    limits: { maxNodes: 2500, maxEdges: 5000 },
    snapshots: [
      {
        id: "s1",
        label: "scan-1",
        ref: "scan-1",
        capturedAt: "2026-01-01T00:00:00.000Z",
        nodeIds: ["a"],
        nodeSignatures: { a: "file:a.ts" },
      },
      {
        id: "s2",
        label: "scan-2",
        ref: "scan-2",
        capturedAt: "2026-01-02T00:00:00.000Z",
        nodeIds: ["a", "b"],
        nodeSignatures: { a: "file:a.ts", b: "file:b.ts" },
      },
    ],
  },
};

describe("EvolutionView", () => {
  it("shows empty state without graph", () => {
    render(
      <EvolutionView
        blueprint={{
          version: 1,
          routes: [],
          securityMatrix: [],
          findings: [],
          facts: [],
          filesAnalyzed: 0,
        }}
      />,
    );
    expect(screen.getByTestId("view-state-not-scanned")).toBeInTheDocument();
  });

  it("switches evolution sub-tab to branch-compare", () => {
    render(<EvolutionView blueprint={graphWithSnapshots} projectId="p1" />);
    fireEvent.click(screen.getByRole("tab", { name: "Branch Compare" }));
    expect(screen.getByTestId("evolution-branch-compare")).toBeInTheDocument();
    expect(screen.getByTestId("evolution-tab-branch-compare")).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("working-tree tab is disabled with reason", () => {
    render(<EvolutionView blueprint={graphWithSnapshots} />);
    const tab = screen.getByTestId("evolution-tab-working-tree");
    expect(tab).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(tab);
    expect(screen.getByRole("tab", { name: "Timeline", selected: true })).toBeInTheDocument();
  });

  it("renders timeline tab with snapshot cards and metrics", () => {
    render(<EvolutionView blueprint={graphWithSnapshots} />);
    expect(screen.getByRole("tab", { name: "Timeline", selected: true })).toBeInTheDocument();
    expect(screen.getByText("Evolutions-Metriken")).toBeInTheDocument();
    expect(screen.getByLabelText("Basis")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /scan-2/i })).toBeInTheDocument();
    expect(screen.getByLabelText("Commit-Timeline")).toBeInTheDocument();
    expect(screen.getByLabelText("Änderungsübersicht")).toBeInTheDocument();
  });

  it("switches evolution sub-tab while keeping snapshot cards visible", () => {
    render(<EvolutionView blueprint={graphWithSnapshots} />);
    fireEvent.click(screen.getByRole("tab", { name: "Commit Diff" }));
    expect(screen.getByTestId("evolution-commit-diff")).toBeInTheDocument();
    expect(screen.getByText("Commit-Diff folgt.")).toBeInTheDocument();
  });

  it("explains the first capture and shows dirty Git provenance", () => {
    const graph = graphWithSnapshots.graph;
    if (!graph) throw new Error("Evolution fixture requires a graph");
    const blueprint: BlueprintData = {
      ...graphWithSnapshots,
      graph: {
        ...graph,
        snapshots: [
          {
            id: "snapshot:abc12345:2026-01-01T00:00:00.000Z",
            label: "legacy-label",
            ref: "abc12345",
            capturedAt: "2026-01-01T00:00:00.000Z",
            nodeIds: ["a"],
            commitSha: "abc12345",
            branch: "main",
            sourceKind: "git",
            dirty: true,
          },
        ],
      },
    };

    render(<EvolutionView blueprint={blueprint} />);

    expect(
      screen.getByText(
        "Nur ein Zeitpunkt vorhanden. Für einen Vergleich braucht VisuDEV mindestens zwei Analysen. Scanne das Projekt später erneut, dann erscheint hier, was sich verändert hat.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText("Commit abc12345 · Branch main · ungespeicherte Änderungen").length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByTitle(
        "Du hast Dateien geändert, aber noch nicht in Git gespeichert. Diese Analyse zeigt deinen aktuellen Stand, nicht den letzten Commit.",
      ),
    ).toBeInTheDocument();
  });
});
