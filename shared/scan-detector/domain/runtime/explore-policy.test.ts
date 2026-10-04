/**
 * Explore policy unit tests (PR-12).
 */

import { describe, expect, it } from "vitest";
import {
  classifyInteractionRisk,
  classifyRequestRisk,
  isInteractionAllowed,
  isRequestAllowed,
  redactExploreEvidence,
  syntheticFormValue,
} from "./explore-policy.js";

describe("explore-policy", () => {
  it("classifies destructive and external interactions", () => {
    expect(classifyInteractionRisk({ label: "Delete account" })).toBe("destructive");
    expect(classifyInteractionRisk({ label: "Checkout", href: "/pay" })).toBe("external");
    expect(classifyInteractionRisk({ tagName: "input", type: "email" })).toBe("form-input");
    expect(classifyInteractionRisk({ role: "tab", label: "Settings" })).toBe("local-state");
  });

  it("blocks mutating requests in safe mode and allows disposable sandbox", () => {
    const risk = classifyRequestRisk({ method: "POST", url: "http://localhost/api/items" });
    expect(risk).toBe("mutating");
    expect(isRequestAllowed(risk, { mode: "safe" })).toBe(false);
    expect(isRequestAllowed(risk, { mode: "sandbox", disposable: false })).toBe(false);
    expect(isRequestAllowed(risk, { mode: "sandbox", disposable: true })).toBe(true);
    expect(
      isRequestAllowed(classifyRequestRisk({ method: "DELETE", url: "http://x/delete" }), {
        mode: "sandbox",
        disposable: true,
      }),
    ).toBe(false);
  });

  it("treats GraphQL mutations as mutating", () => {
    expect(
      classifyRequestRisk({
        method: "POST",
        url: "http://localhost/graphql",
        postData: '{"query":"mutation { createItem }"}',
      }),
    ).toBe("mutating");
  });

  it("generates synthetic typed form values and redacts secrets", () => {
    expect(syntheticFormValue({ type: "email" })).toContain("@example.test");
    expect(redactExploreEvidence("Authorization: Bearer abcdefghijklmnop")).toContain("[REDACTED]");
  });

  it("keeps destructive interactions blocked in sandbox", () => {
    expect(isInteractionAllowed("destructive", { mode: "sandbox", disposable: true })).toBe(false);
    expect(isInteractionAllowed("external", { mode: "sandbox", disposable: true })).toBe(false);
  });
});
