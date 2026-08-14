/**
 * Per-view nothing-found copy after a completed scan (Honest-Core P1-4).
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ArchitectureView } from "./ArchitectureView";
import { AtlasView } from "./AtlasView";
import { DependenciesView } from "./DependenciesView";
import { DiagnosticsView } from "./DiagnosticsView";
import { EvolutionView } from "./EvolutionView";
import { ExecutionView } from "./ExecutionView";
import { InfrastructureView } from "./InfrastructureView";
import type { BlueprintData } from "../types";

const emptyBlueprint: BlueprintData = {
  version: 1,
  routes: [],
  securityMatrix: [],
  findings: [],
  facts: [],
  filesAnalyzed: 0,
};

describe("Blueprint view nothing-found states", () => {
  it("atlas names searched cluster kinds", () => {
    render(<AtlasView blueprint={emptyBlueprint} scanStatus="completed" />);
    expect(screen.getByTestId("view-state-nothing-found")).toHaveTextContent(
      "Systemen, Services, Modulen und Datei-Clustern",
    );
  });

  it("architecture names domain path patterns", () => {
    render(<ArchitectureView blueprint={emptyBlueprint} scanStatus="completed" />);
    expect(screen.getByTestId("view-state-nothing-found")).toHaveTextContent(
      "Domain-Zuordnung in den Modul-Pfaden",
    );
  });

  it("dependencies names edge kinds", () => {
    render(<DependenciesView blueprint={emptyBlueprint} scanStatus="completed" />);
    expect(screen.getByTestId("view-state-nothing-found")).toHaveTextContent(
      "Import-, Call-, API-, Event- und Data-Kanten",
    );
  });

  it("execution names pipeline steps", () => {
    render(<ExecutionView blueprint={emptyBlueprint} scanStatus="completed" />);
    expect(screen.getByTestId("view-state-nothing-found")).toHaveTextContent(
      "Pipeline-Schritten und gemessenen Timings",
    );
  });

  it("infrastructure names runtime nodes", () => {
    render(<InfrastructureView blueprint={emptyBlueprint} scanStatus="completed" />);
    expect(screen.getByTestId("view-state-nothing-found")).toHaveTextContent(
      "docker-compose.yml und Kubernetes-Manifesten",
    );
  });

  it("diagnostics names security patterns", () => {
    render(<DiagnosticsView blueprint={emptyBlueprint} scanStatus="completed" />);
    expect(screen.getByTestId("view-state-nothing-found")).toHaveTextContent(
      "Security-, Coverage-, Qualitäts-Mustern",
    );
  });

  it("evolution names git commits", () => {
    render(<EvolutionView blueprint={emptyBlueprint} scanStatus="completed" />);
    expect(screen.getByTestId("view-state-nothing-found")).toHaveTextContent(
      "Git-Commits und Snapshot-Diffs",
    );
  });
});
