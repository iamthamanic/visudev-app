/**
 * Tests for ExecutionView route selection and step list.
 */

import { render, screen, fireEvent, within } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ExecutionView } from "./ExecutionView";
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
      {
        id: "route:users:get",
        kind: "route",
        label: "GET /users",
        scopeId: "file:handler",
        filePath: "src/routes/users.ts",
        line: 10,
        metadata: { routeId: "route:users:get" },
      },
      {
        id: "file:handler",
        kind: "file",
        label: "users.ts",
        filePath: "src/routes/users.ts",
        line: 10,
        metadata: {},
      },
    ],
    edges: [],
    evidence: [
      {
        id: "ev-1",
        factId: "fact-1",
        kind: "autoguide:auth",
        filePath: "src/routes/users.ts",
        line: 10,
        excerpt: "requireAuth()",
      },
    ],
    groups: [
      {
        id: "execution:route:users:get:0",
        kind: "route",
        label: "GET /users · path 1",
        nodeIds: ["route:users:get", "file:handler"],
      },
    ],
    metrics: [],
    condensed: false,
    limits: { maxNodes: 2500, maxEdges: 5000 },
  },
};

describe("ExecutionView", () => {
  it("shows empty state without graph", () => {
    render(
      <ExecutionView
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

  it("renders step pipeline cards and Schritte list", () => {
    render(<ExecutionView blueprint={graphBlueprint} />);
    const pipeline = screen.getByLabelText("Ausführungs-Pipeline");
    const schritte = screen.getByLabelText("Schritte");
    expect(within(pipeline).getByRole("button", { name: /GET \/users/i })).toBeInTheDocument();
    expect(
      within(schritte).getByRole("button", { name: /Handler users\.ts/i }),
    ).toBeInTheDocument();
  });

  it("selects a step and shows evidence in inspector and Headers tab", () => {
    render(<ExecutionView blueprint={graphBlueprint} />);
    const schritte = screen.getByLabelText("Schritte");
    fireEvent.click(within(schritte).getByRole("button", { name: /Handler users\.ts/i }));
    expect(screen.getAllByText(/requireAuth/i).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("tab", { name: "Headers" }));
    expect(screen.getAllByText(/requireAuth/i).length).toBeGreaterThan(0);
  });

  it("renders timeline ruler and metrics bar", () => {
    render(<ExecutionView blueprint={graphBlueprint} />);
    expect(screen.getByLabelText("Zeitachse")).toBeInTheDocument();
    expect(screen.getByLabelText("Ausführungs-Metriken")).toBeInTheDocument();
    expect(screen.getByText(/Schritte: 2/i)).toBeInTheDocument();
  });

  it("shows LIVE badge when route is running", () => {
    const liveBlueprint: BlueprintData = {
      ...graphBlueprint,
      graph: {
        ...graphBlueprint.graph!,
        nodes: graphBlueprint.graph!.nodes.map((node) =>
          node.id === "route:users:get"
            ? { ...node, metadata: { ...node.metadata, executionStatus: "running" } }
            : node,
        ),
      },
    };
    render(<ExecutionView blueprint={liveBlueprint} />);
    expect(screen.getByText("Live")).toBeInTheDocument();
  });

  it("shows Projektion badge when there is no running telemetry (P0-4)", () => {
    render(<ExecutionView blueprint={graphBlueprint} />);
    expect(screen.getByTestId("execution-mode-badge")).toHaveTextContent("Projektion");
    expect(screen.getByTestId("execution-mode-badge")).toHaveAttribute("data-live", "false");
  });
});
