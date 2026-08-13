/** Vitest smoke for topology diagram, filters, legend, and inspector meters. */

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { InfrastructureView } from "./InfrastructureView";
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
        id: "runtime:internet",
        kind: "runtime",
        label: "Internet",
        metadata: {},
      },
      {
        id: "runtime:lb",
        kind: "runtime",
        label: "LOAD BALANCER / GATEWAY",
        metadata: {},
      },
      {
        id: "service:web",
        kind: "service",
        label: "Web App",
        metadata: {},
      },
      {
        id: "service:api",
        kind: "service",
        label: "API Service",
        metadata: {},
      },
      {
        id: "tbl:users",
        kind: "table",
        label: "PostgreSQL",
        metadata: {},
      },
      {
        id: "external:stripe",
        kind: "external",
        label: "Payment API (Stripe)",
        metadata: {},
      },
      {
        id: "external:monitor",
        kind: "external",
        label: "Prometheus",
        metadata: {},
      },
    ],
    edges: [
      {
        id: "e-data",
        kind: "data",
        sourceId: "service:api",
        targetId: "tbl:users",
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

describe("InfrastructureView", () => {
  it("shows empty state without graph nodes", () => {
    render(
      <InfrastructureView
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

  it("renders topology diagram with filters and legend", () => {
    render(<InfrastructureView blueprint={graphBlueprint} />);
    const topology = screen.getByLabelText("Infrastruktur-Topologie");
    expect(topology).toBeInTheDocument();
    expect(topology).toHaveTextContent("Internet");
    expect(screen.getByTestId("infra-external-apis")).toBeInTheDocument();
    expect(screen.getByTestId("infra-monitoring-tier")).toBeInTheDocument();
    expect(screen.getByLabelText("Verbindungs-Legende")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Logische Topologie/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Physische Topologie/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Aktualisieren/i })).toBeInTheDocument();
  });

  it("hides env/region filters when no node carries deployment metadata (P0-2)", () => {
    render(<InfrastructureView blueprint={graphBlueprint} />);
    expect(screen.queryByRole("button", { name: /Produktion/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /eu-central-1/i })).not.toBeInTheDocument();
  });

  it("shows env/region filters derived from real node metadata", () => {
    const withMeta: BlueprintData = {
      ...graphBlueprint,
      graph: {
        ...graphBlueprint.graph!,
        nodes: graphBlueprint.graph!.nodes.map((node) =>
          node.id === "service:web"
            ? { ...node, metadata: { env: "prod", region: "eu-central-1" } }
            : node,
        ),
      },
    };
    render(<InfrastructureView blueprint={withMeta} />);
    expect(screen.getByRole("button", { name: "prod" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "eu-central-1" })).toBeInTheDocument();
  });

  it("shows honest runtime empty-state instead of placeholder meters (P0-2)", () => {
    render(<InfrastructureView blueprint={graphBlueprint} />);
    fireEvent.click(screen.getAllByRole("button", { name: /Web App/i })[0]);
    expect(screen.getByText("Übersicht")).toBeInTheDocument();
    expect(screen.getByText("Ressourcen")).toBeInTheDocument();
    expect(screen.queryByTestId("infra-resource-cpu")).not.toBeInTheDocument();
    expect(screen.getByTestId("infra-runtime-empty")).toBeInTheDocument();
    expect(screen.getByText("Verbindungen")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Logs anzeigen/i })).toBeInTheDocument();
  });

  it("renders real resource meters when node metadata has telemetry", () => {
    const withTelemetry: BlueprintData = {
      ...graphBlueprint,
      graph: {
        ...graphBlueprint.graph!,
        nodes: graphBlueprint.graph!.nodes.map((node) =>
          node.id === "service:web"
            ? { ...node, metadata: { cpu: 55, ram: 61, networkIn: 10, networkOut: 8 } }
            : node,
        ),
      },
    };
    render(<InfrastructureView blueprint={withTelemetry} />);
    fireEvent.click(screen.getAllByRole("button", { name: /Web App/i })[0]);
    expect(screen.getByTestId("infra-resource-cpu")).toBeInTheDocument();
  });
});
