/**
 * Tests for BlueprintViewShell controlled view rendering (#86).
 */

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { BlueprintViewShell } from "./BlueprintViewShell";
import type { BlueprintData } from "../types";

const emptyBlueprint: BlueprintData = {
  version: 1,
  routes: [],
  securityMatrix: [],
  findings: [],
  facts: [],
  filesAnalyzed: 0,
};

describe("BlueprintViewShell", () => {
  it("renders German view header for diagnostics", () => {
    render(
      <BlueprintViewShell
        blueprint={emptyBlueprint}
        activeView="diagnostics"
        projectName="Demo"
        branchLabel="main"
      />,
    );
    expect(screen.getByRole("heading", { name: "Diagnosen" })).toBeInTheDocument();
    expect(screen.getByText("Demo › main")).toBeInTheDocument();
  });

  it("renders infrastructure view when activeView is infrastructure", () => {
    render(<BlueprintViewShell blueprint={emptyBlueprint} activeView="infrastructure" />);
    expect(screen.getByText("Keine Infrastruktur-Daten")).toBeInTheDocument();
  });

  it("renders dependencies view when activeView is dependencies", () => {
    render(<BlueprintViewShell blueprint={emptyBlueprint} activeView="dependencies" />);
    expect(screen.getByText("Keine Abhängigkeits-Daten")).toBeInTheDocument();
  });

  it("does not render horizontal tab bar", () => {
    render(<BlueprintViewShell blueprint={emptyBlueprint} activeView="atlas" />);
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  });

  it("opens the glossary drawer from the header", () => {
    render(<BlueprintViewShell blueprint={emptyBlueprint} activeView="atlas" />);
    fireEvent.click(screen.getByRole("button", { name: "Begriffsregister öffnen" }));
    expect(screen.getByTestId("glossary-drawer")).toBeInTheDocument();
    expect(screen.getByTestId("glossary-drawer")).toHaveTextContent("Projektion");
  });
});
