/**
 * Honest-Core P0-2: footer health line reflects the real critical-finding
 * count, not a static "Keine kritischen Probleme".
 */

import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { BlueprintFooterStatusBar } from "./BlueprintFooterStatusBar";
import type { BlueprintGraphStats } from "./blueprint-graph-stats";

const stats: BlueprintGraphStats = {
  moduleCount: 3,
  fileCount: 12,
  dependencyCount: 8,
};

describe("BlueprintFooterStatusBar", () => {
  it("shows 'Keine kritischen Probleme' only when criticalCount is 0", () => {
    render(
      <BlueprintFooterStatusBar
        stats={stats}
        freshnessLabel="vor 1 Min."
        onRefresh={() => {}}
        criticalCount={0}
      />,
    );
    expect(screen.getByTestId("footer-health-line")).toHaveTextContent("Keine kritischen Probleme");
  });

  it("shows the real critical count when findings exist", () => {
    render(
      <BlueprintFooterStatusBar
        stats={stats}
        freshnessLabel="vor 1 Min."
        onRefresh={() => {}}
        criticalCount={4}
      />,
    );
    expect(screen.getByTestId("footer-health-line")).toHaveTextContent("4 kritische Probleme");
  });
});
