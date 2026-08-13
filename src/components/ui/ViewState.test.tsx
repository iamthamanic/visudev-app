/**
 * Tests for the five Honest-Core ViewState empty states (P1-4).
 */

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ViewState, VIEW_STATE_NAMES } from "./ViewState";

describe("ViewState", () => {
  it("renders each of the five states with its test id", () => {
    for (const name of VIEW_STATE_NAMES) {
      const { unmount } = render(
        <ViewState name={name} title={`Titel ${name}`} detail={`Detail ${name}`} />,
      );
      expect(screen.getByTestId(`view-state-${name}`)).toHaveTextContent(`Titel ${name}`);
      expect(screen.getByTestId(`view-state-${name}`)).toHaveTextContent(`Detail ${name}`);
      unmount();
    }
  });

  it("shows retry on error when onRetry is provided", () => {
    const onRetry = vi.fn();
    render(
      <ViewState
        name="error"
        title="Analyse fehlgeschlagen"
        detail="Git exited with code 128"
        onRetry={onRetry}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Erneut analysieren" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
