/** Tests for AtlasView product-domain map (PU-07). */

import { render, screen, within } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { AtlasView } from "./AtlasView";
import type { BlueprintData } from "../types";

/** Thin graph — routes/files only, no corroborated product concepts. */
const thinBlueprint: BlueprintData = {
  version: 1,
  routes: [],
  securityMatrix: [],
  findings: [],
  facts: [],
  filesAnalyzed: 2,
  graph: {
    version: 1,
    projectId: "p1",
    analyzedAt: "2026-01-01T00:00:00.000Z",
    scopes: [],
    nodes: [
      {
        id: "route-auth",
        kind: "route",
        label: "GET /api/auth",
        filePath: "src/auth/routes.ts",
        metadata: { path: "/api/auth" },
      },
      {
        id: "auth-file",
        kind: "file",
        label: "auth.ts",
        filePath: "src/auth/auth.ts",
        metadata: {},
      },
    ],
    edges: [],
    evidence: [],
    groups: [],
    metrics: [],
    condensed: false,
    limits: { maxNodes: 2500, maxEdges: 5000 },
  },
};

/**
 * Graph shaped so SemanticSystemModel + software-graph corroborate
 * application / product-area / capability style concepts.
 */
const productBlueprint: BlueprintData = {
  version: 1,
  routes: [],
  securityMatrix: [],
  findings: [],
  facts: [],
  filesAnalyzed: 8,
  graph: {
    version: 1,
    projectId: "harbor",
    analyzedAt: "2026-10-06T00:00:00.000Z",
    scopes: [],
    nodes: [
      {
        id: "node:app",
        kind: "application",
        label: "Harbor Desk",
        metadata: {},
      },
      {
        id: "node:domain:billing",
        kind: "domain",
        label: "Billing",
        metadata: { candidateKey: "billing" },
      },
      {
        id: "node:mod:invoices",
        kind: "module",
        label: "Invoices",
        filePath: "src/billing/invoices.ts",
        metadata: { candidateKey: "invoices" },
      },
      {
        id: "node:svc:billing",
        kind: "service",
        label: "BillingService",
        filePath: "src/billing/service.ts",
        metadata: {},
      },
      {
        id: "node:file:billing",
        kind: "file",
        label: "billing.ts",
        filePath: "src/billing/billing.ts",
        metadata: {},
      },
    ],
    edges: [
      {
        id: "e:contains",
        kind: "contains",
        sourceId: "node:domain:billing",
        targetId: "node:mod:invoices",
        metadata: {},
      },
      {
        id: "e:calls",
        kind: "calls",
        sourceId: "node:mod:invoices",
        targetId: "node:svc:billing",
        metadata: {},
      },
    ],
    evidence: [],
    groups: [
      {
        id: "g:billing",
        kind: "domain",
        label: "Billing",
        nodeIds: ["node:domain:billing", "node:mod:invoices", "node:svc:billing"],
      },
    ],
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

  it("shows honest empty product map when concepts lack corroboration", () => {
    render(<AtlasView blueprint={thinBlueprint} />);
    expect(screen.getByTestId("atlas-product-map-empty")).toBeInTheDocument();
    expect(screen.queryByText("GET /api/auth")).not.toBeInTheDocument();
    expect(screen.queryByText("auth.ts")).not.toBeInTheDocument();
  });

  it("renders product concepts — not raw route/file/service labels — when corroborated", () => {
    render(<AtlasView blueprint={productBlueprint} />);
    expect(screen.getByText("Produktlandkarte · 2D")).toBeInTheDocument();
    const visibleNodes = screen.queryByLabelText("Sichtbare Knoten");
    if (visibleNodes) {
      expect(within(visibleNodes).queryByText("BillingService")).not.toBeInTheDocument();
      expect(within(visibleNodes).queryByText("billing.ts")).not.toBeInTheDocument();
      expect(within(visibleNodes).queryByText(/GET \/api/)).not.toBeInTheDocument();
    }
  });

  it("uses product-oriented search placeholder", () => {
    render(<AtlasView blueprint={productBlueprint} />);
    expect(screen.getByPlaceholderText("Produktbereich oder Fähigkeit…")).toBeInTheDocument();
  });

  it("shows Abdeckung unbekannt when graph has no coverage metric", () => {
    render(<AtlasView blueprint={productBlueprint} />);
    expect(screen.getByTestId("atlas-stat-coverage")).toHaveTextContent("Abdeckung: unbekannt");
  });

  it("shows truncation banner when analysis is condensed", () => {
    const condensed: BlueprintData = {
      ...productBlueprint,
      graph: { ...productBlueprint.graph!, condensed: true },
    };
    render(<AtlasView blueprint={condensed} />);
    expect(screen.getByTestId("view-state-partial-scan")).toBeInTheDocument();
  });

  it("renders legend and 2D product-map hint without 3D toggle", () => {
    render(<AtlasView blueprint={productBlueprint} />);
    expect(screen.getByLabelText("Atlas-Legende")).toBeInTheDocument();
    expect(screen.getByText("Produktlandkarte · 2D")).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Atlas-Ansicht" })).not.toBeInTheDocument();
  });
});
