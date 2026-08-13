/**
 * Tests for MetricHint tooltip copy (Honest-Core P1-3).
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MetricHint } from "./MetricHint";

describe("MetricHint", () => {
  it("exposes Kurzdefinition and graph source", () => {
    render(
      <MetricHint glossaryId="abdeckung">
        <span>Abdeckung: 87%</span>
      </MetricHint>,
    );
    expect(screen.getByTestId("metric-hint")).toHaveAttribute(
      "aria-label",
      "Anteil der Dateien, die dieser Scan wirklich analysiert hat. Quelle: graph",
    );
  });

  it("uses Quelle: unbekannt when the value is unknown", () => {
    render(
      <MetricHint glossaryId="confidence" source="unbekannt">
        <span>unbekannt</span>
      </MetricHint>,
    );
    expect(screen.getByTestId("metric-hint")).toHaveAttribute(
      "aria-label",
      "Wie sicher die Analyse diesen Befund einschätzt. Quelle: unbekannt",
    );
  });
});
