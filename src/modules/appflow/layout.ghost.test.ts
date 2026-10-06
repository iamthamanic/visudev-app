/**
 * PU-06: ghost-layer positioning relative to parent.
 */
import { describe, expect, it } from "vitest";
import { computePositions, getScreenDepths } from "./layout";
import type { Screen } from "../../lib/visudev/types";

describe("computePositions ghost layers", () => {
  it("offsets modal/tab children from parent instead of independent route column peers only", () => {
    const screens: Screen[] = [
      {
        id: "home",
        name: "Home",
        path: "/",
        filePath: "a.tsx",
        type: "page",
        flows: [],
        navigatesTo: [],
        framework: "test",
      },
      {
        id: "modal",
        name: "Create",
        path: "/",
        filePath: "a.tsx",
        type: "modal",
        flows: [],
        navigatesTo: [],
        framework: "test",
        parentScreenId: "home",
        stateKey: "modal:create",
      },
    ];
    const depths = getScreenDepths(screens);
    const pos = computePositions(screens, depths, 320, 296, 80, 40);
    const home = pos.get("home")!;
    const modal = pos.get("modal")!;
    expect(modal.x).toBeGreaterThan(home.x);
    expect(modal.y).toBeGreaterThanOrEqual(home.y);
  });
});
