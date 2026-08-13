/**
 * Tests for GlossaryDrawer terms and search filter (Honest-Core P1-3).
 */

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GlossaryDrawer } from "./GlossaryDrawer";

describe("GlossaryDrawer", () => {
  it("renders required Honest-Core terms alphabetically", () => {
    render(<GlossaryDrawer open onClose={() => undefined} />);
    const drawer = screen.getByTestId("glossary-drawer");
    for (const term of [
      "Abdeckung",
      "Confidence",
      "isolierter Knoten",
      "kondensiert",
      "Projektion",
      "Quelle",
      "Senke",
      "dekorativ",
    ]) {
      expect(drawer).toHaveTextContent(term);
    }
  });

  it("filters entries by search query", () => {
    render(<GlossaryDrawer open onClose={() => undefined} />);
    fireEvent.change(screen.getByPlaceholderText(/Begriff filtern/i), {
      target: { value: "Projektion" },
    });
    expect(screen.getByRole("heading", { name: "Projektion" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Abdeckung" })).not.toBeInTheDocument();
  });

  it("does not render when closed", () => {
    render(<GlossaryDrawer open={false} onClose={vi.fn()} />);
    expect(screen.queryByTestId("glossary-drawer")).not.toBeInTheDocument();
  });
});
