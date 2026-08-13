/**
 * Tests for AtlasLegend visual-channel copy, decorative source, and toggle (P1-6).
 */

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AtlasLegend } from "./AtlasLegend.js";

describe("AtlasLegend", () => {
  it("renders each visual channel with meaning and source", () => {
    render(<AtlasLegend />);
    const legend = screen.getByTestId("atlas-legend");
    expect(legend).toHaveTextContent("Farbe: Cluster-Rolle — Quelle: graph");
    expect(legend).toHaveTextContent("Höhe: Knotentyp — Quelle: graph");
    expect(legend).toHaveTextContent("Nähe: Distrikt (Graph-Gruppe) — Quelle: graph");
    expect(legend).toHaveTextContent("Grundfläche: festes Rastermaß — Quelle: dekorativ");
    expect(screen.getAllByTestId("atlas-legend-channel")).toHaveLength(4);
  });

  it("marks decorative channels explicitly", () => {
    render(<AtlasLegend />);
    const decorative = screen
      .getAllByTestId("atlas-legend-channel")
      .filter((node) => node.getAttribute("data-source") === "dekorativ");
    expect(decorative).toHaveLength(1);
    expect(decorative[0]).toHaveTextContent("Grundfläche");
  });

  it("can hide and show the legend", () => {
    render(<AtlasLegend />);
    fireEvent.click(screen.getByRole("button", { name: "Legende ausblenden" }));
    expect(screen.queryByTestId("atlas-legend")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Legende einblenden" }));
    expect(screen.getByTestId("atlas-legend")).toBeInTheDocument();
  });
});
