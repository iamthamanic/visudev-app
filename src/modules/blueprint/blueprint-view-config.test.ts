import { describe, expect, it } from "vitest";
import {
  BLUEPRINT_VIEWS,
  blueprintViewPath,
  getDefaultBlueprintView,
  getBlueprintViewLabel,
  parseBlueprintViewFromLocation,
  parseBlueprintViewParam,
} from "./blueprint-view-config";

describe("blueprint-view-config", () => {
  it("defaults to diagnostics", () => {
    expect(getDefaultBlueprintView()).toBe("diagnostics");
  });

  it("parses valid view params", () => {
    expect(parseBlueprintViewParam("atlas")).toBe("atlas");
    expect(parseBlueprintViewParam("invalid")).toBe("diagnostics");
  });

  it("builds nested blueprint paths", () => {
    expect(blueprintViewPath("atlas")).toBe("/blueprint/atlas");
  });

  it("reads view from pathname, then legacy query", () => {
    expect(parseBlueprintViewFromLocation("/blueprint/atlas", "")).toBe("atlas");
    expect(parseBlueprintViewFromLocation("/blueprint", "?view=execution")).toBe("execution");
    expect(parseBlueprintViewFromLocation("/blueprint", "")).toBe("diagnostics");
  });

  it("exposes seven German sidebar labels", () => {
    expect(BLUEPRINT_VIEWS).toHaveLength(7);
    expect(getBlueprintViewLabel("dependencies")).toBe("Abhängigkeiten");
    expect(getBlueprintViewLabel("diagnostics")).toBe("Diagnosen");
  });
});
