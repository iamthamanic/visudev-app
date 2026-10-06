/**
 * PU-13: Diagnostics consequence presenter tests.
 */
import { describe, expect, it } from "vitest";
import { presentDiagnosticsFindingConsequence } from "./project-diagnostics-consequences.js";

describe("presentDiagnosticsFindingConsequence", () => {
  it("leads with grounded consequence for auth findings", () => {
    const view = presentDiagnosticsFindingConsequence({
      id: "f1",
      ruleId: "visudev/missing-auth",
      category: "auth",
      message: "Route ohne Auth",
      expectedState: "protected",
      actualState: "unprotected",
      confidence: 0.9,
    });
    expect(view.consequenceConfidence).toBe("grounded");
    expect(view.consequenceTitle).toMatch(/Unbefugte/i);
    expect(view.consequenceTitle).not.toMatch(/visudev\/missing-auth/);
    expect(view.ruleId).toBe("visudev/missing-auth");
  });

  it("uses validation consequence copy", () => {
    const view = presentDiagnosticsFindingConsequence({
      id: "f2",
      ruleId: "visudev/missing-validation",
      category: "validation",
      message: "Input unchecked",
      expectedState: "validated",
      actualState: "unvalidated",
      confidence: 0.85,
    });
    expect(view.consequenceTitle).toMatch(/Ungültige Daten/i);
  });

  it("shows Auswirkung unklar when mapping is unsafe", () => {
    const view = presentDiagnosticsFindingConsequence({
      id: "f3",
      ruleId: "custom.obscure-check",
      category: "misc",
      message: "Something odd",
      expectedState: "ok",
      actualState: "odd",
      confidence: 0.9,
    });
    expect(view.consequenceTitle).toBe("Auswirkung unklar");
    expect(view.consequenceConfidence).toBe("unclear");
  });

  it("treats low confidence as unclear even for known rules", () => {
    const view = presentDiagnosticsFindingConsequence({
      id: "f4",
      ruleId: "visudev/missing-auth",
      category: "auth",
      message: "Maybe unprotected",
      expectedState: "protected",
      actualState: "unprotected",
      confidence: 20,
    });
    expect(view.consequenceConfidence).toBe("unclear");
    expect(view.consequenceTitle).toBe("Auswirkung unklar");
  });
});
