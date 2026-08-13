/**
 * Tests for AtlasView empty state, search controls, selection, and Inspektor tabs.
 */

import { render, screen, fireEvent, within } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { AtlasView } from "./AtlasView";
import type { BlueprintData } from "../types";

const graphBlueprint: BlueprintData = {
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
      { id: "m1", kind: "module", label: "auth", metadata: {} },
      { id: "m2", kind: "module", label: "billing", metadata: {} },
    ],
    edges: [{ id: "e1", kind: "references", sourceId: "m1", targetId: "m2", metadata: {} }],
    evidence: [],
    groups: [{ id: "g1", kind: "module", label: "core", nodeIds: ["m1", "m2"] }],
    metrics: [],
    condensed: false,
    limits: { maxNodes: 2500, maxEdges: 5000 },
  },
};

describe("AtlasView", () => {
  it("shows empty state without graph", () => {
    render(
      <AtlasView
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
    expect(screen.getByText("Keine Atlas-Daten")).toBeInTheDocument();
  });

  it("renders stats bar, legend, and view mode toggle", () => {
    render(<AtlasView blueprint={graphBlueprint} />);
    expect(screen.getByLabelText("Atlas-Statistik")).toBeInTheDocument();
    expect(screen.getByLabelText("Atlas-Legende")).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Atlas-Ansicht" })).toBeInTheDocument();
  });

  it("shows Abdeckung unbekannt when graph has no coverage metric", () => {
    render(<AtlasView blueprint={graphBlueprint} />);
    expect(screen.getByTestId("atlas-stat-coverage")).toHaveTextContent("Abdeckung: unbekannt");
  });

  it("shows truncation banner when analysis is condensed", () => {
    const condensed: BlueprintData = {
      ...graphBlueprint,
      graph: { ...graphBlueprint.graph!, condensed: true },
    };
    render(<AtlasView blueprint={condensed} />);
    expect(screen.getByTestId("truncation-banner")).toBeInTheDocument();
  });

  it("shows truncation banner when filesAnalyzed < totalFiles", () => {
    const partial: BlueprintData = { ...graphBlueprint, filesAnalyzed: 400, totalFiles: 1706 };
    render(<AtlasView blueprint={partial} />);
    expect(screen.getByTestId("truncation-banner")).toBeInTheDocument();
  });

  it("hides truncation banner on a complete scan", () => {
    render(<AtlasView blueprint={graphBlueprint} />);
    expect(screen.queryByTestId("truncation-banner")).not.toBeInTheDocument();
  });

  it("renders search, node cards, and overview stats", () => {
    render(<AtlasView blueprint={graphBlueprint} />);
    const controls = screen.getByLabelText("Atlas-Steuerung");
    expect(within(controls).getByText(/2 von 2 Knoten sichtbar/)).toBeInTheDocument();
    expect(within(controls).getByText("auth")).toBeInTheDocument();
    expect(within(controls).getByText("billing")).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText("Label durchsuchen…"), {
      target: { value: "bill" },
    });
    expect(within(controls).getByText(/1 von 2 Knoten sichtbar/)).toBeInTheDocument();
  });

  it("shows Inspektor sub-tabs when a node is selected", () => {
    render(<AtlasView blueprint={graphBlueprint} />);
    fireEvent.click(screen.getByRole("button", { name: /auth/i }));
    expect(screen.getByRole("tab", { name: "Übersicht" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Abhängigkeiten" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Deployments" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Abhängigkeiten" }));
    expect(screen.getByText(/references → billing/)).toBeInTheDocument();
  });

  it("shows cluster chip and cluster overview in Inspektor", () => {
    render(<AtlasView blueprint={graphBlueprint} />);
    const clusterSection = screen.getByLabelText("Cluster");
    fireEvent.click(within(clusterSection).getByText("core"));
    expect(screen.getByRole("heading", { name: "core" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Details" }));
    const inspector = screen.getByLabelText("Inspektor");
    expect(within(inspector).getByText("auth")).toBeInTheDocument();
    expect(within(inspector).getByText("billing")).toBeInTheDocument();
  });

  it("clears node selection when search filters it out", () => {
    render(<AtlasView blueprint={graphBlueprint} />);
    fireEvent.click(screen.getByRole("button", { name: /auth/i }));
    expect(screen.getByRole("heading", { name: "auth" })).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText("Label durchsuchen…"), {
      target: { value: "bill" },
    });
    expect(screen.getByRole("heading", { name: "Keine Auswahl" })).toBeInTheDocument();
  });
});
