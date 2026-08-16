/** Tests for AtlasView semantic overview, search and evidence drill-down. */

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
  filesAnalyzed: 4,
  graph: {
    version: 1,
    projectId: "p1",
    analyzedAt: "2026-01-01T00:00:00.000Z",
    scopes: [],
    nodes: [
      { id: "app", kind: "application", label: "Example App", metadata: {} },
      {
        id: "route-auth",
        kind: "route",
        label: "GET /api/auth",
        filePath: "src/auth/routes.ts",
        metadata: { path: "/api/auth" },
      },
      {
        id: "auth-service",
        kind: "service",
        label: "AuthService",
        filePath: "src/auth/service.ts",
        metadata: {},
      },
      {
        id: "auth-file",
        kind: "file",
        label: "auth.ts",
        filePath: "src/auth/auth.ts",
        metadata: {},
      },
      {
        id: "route-billing",
        kind: "route",
        label: "GET /api/billing",
        filePath: "src/billing/routes.ts",
        metadata: { path: "/api/billing" },
      },
      {
        id: "billing-service",
        kind: "service",
        label: "BillingService",
        filePath: "src/billing/service.ts",
        metadata: {},
      },
      {
        id: "billing-file",
        kind: "file",
        label: "billing.ts",
        filePath: "src/billing/billing.ts",
        metadata: {},
      },
    ],
    edges: [
      {
        id: "auth-call",
        kind: "calls",
        sourceId: "route-auth",
        targetId: "auth-service",
        metadata: {},
      },
      {
        id: "billing-call",
        kind: "calls",
        sourceId: "route-billing",
        targetId: "billing-service",
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
    expect(screen.getByTestId("view-state-not-scanned")).toBeInTheDocument();
  });

  it("renders semantic application/domain nodes instead of route/file labels", () => {
    render(<AtlasView blueprint={graphBlueprint} />);
    const controls = screen.getByLabelText("Atlas-Steuerung");
    expect(within(controls).getByText("Example App")).toBeInTheDocument();
    expect(within(controls).getByText("Auth")).toBeInTheDocument();
    expect(within(controls).getByText("Billing")).toBeInTheDocument();
    expect(within(controls).queryByText("GET /api/auth")).not.toBeInTheDocument();
    expect(within(controls).queryByText("auth.ts")).not.toBeInTheDocument();
  });

  it("uses search as progressive disclosure for semantic services", () => {
    render(<AtlasView blueprint={graphBlueprint} />);
    fireEvent.change(screen.getByPlaceholderText("Label durchsuchen…"), {
      target: { value: "AuthService" },
    });
    const controls = screen.getByLabelText("Atlas-Steuerung");
    expect(within(controls).getByText("AuthService")).toBeInTheDocument();
    expect(within(controls).queryByText("auth.ts")).not.toBeInTheDocument();
  });

  it("keeps domain membership available for raw graph drill-down", () => {
    render(<AtlasView blueprint={graphBlueprint} />);
    const clusterSection = screen.getByLabelText("Cluster");
    fireEvent.click(within(clusterSection).getByText("Auth"));
    expect(screen.getByRole("heading", { name: "Auth" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Details" }));
    const inspector = screen.getByLabelText("Inspektor");
    expect(within(inspector).getByText("auth.ts")).toBeInTheDocument();
    expect(within(inspector).getByText("AuthService")).toBeInTheDocument();
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
    expect(screen.getByTestId("view-state-partial-scan")).toBeInTheDocument();
  });

  it("renders legend and view mode toggle", () => {
    render(<AtlasView blueprint={graphBlueprint} />);
    expect(screen.getByLabelText("Atlas-Legende")).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Atlas-Ansicht" })).toBeInTheDocument();
  });
});
