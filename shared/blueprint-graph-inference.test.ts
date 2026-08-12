/**
 * Unit tests for P0-6 security state inference (analyzability + typed facts).
 * Location: shared/blueprint-graph-inference.test.ts
 */

import { describe, expect, it } from "vitest";
import {
  buildRouteFactsIndexes,
  inferAuthState,
  inferValidationState,
  resolveAuthState,
  resolveValidationState,
} from "./blueprint-graph-inference.js";
import type { ProjectedCodeFact, ProjectedRoute } from "./blueprint-graph-types.js";

function route(
  partial: Partial<ProjectedRoute> & Pick<ProjectedRoute, "id" | "method">,
): ProjectedRoute {
  return {
    path: "/api/x",
    filePath: "src/routes/x.ts",
    line: 10,
    pipeline: [],
    concepts: {},
    ...partial,
  };
}

function fact(
  partial: Partial<ProjectedCodeFact> & Pick<ProjectedCodeFact, "id" | "kind">,
): ProjectedCodeFact {
  return {
    filePath: "src/routes/x.ts",
    line: 1,
    snippet: "code",
    metadata: {},
    ...partial,
  };
}

describe("resolveAuthState / resolveValidationState", () => {
  it("returns confirmed when evidence exists regardless of analyzability", () => {
    expect(resolveAuthState(true, "not-analyzable")).toBe("confirmed");
    expect(resolveValidationState(true, "analyzable")).toBe("confirmed");
  });

  it("returns missing only when analyzable and no evidence", () => {
    expect(resolveAuthState(false, "analyzable")).toBe("missing");
    expect(resolveValidationState(false, "analyzable")).toBe("missing");
  });

  it("returns unknown when not analyzable and no evidence", () => {
    expect(resolveAuthState(false, "not-analyzable")).toBe("unknown");
    expect(resolveValidationState(false, "not-analyzable")).toBe("unknown");
  });
});

describe("inferAuthState / inferValidationState", () => {
  it("mutating route without facts is unknown, not missing", () => {
    const r = route({ id: "r1", method: "POST" });
    expect(inferAuthState(r, [], "not-analyzable")).toBe("unknown");
    expect(inferValidationState(r, [], "not-analyzable")).toBe("unknown");
  });

  it("mutating route in parsed file without auth fact is missing", () => {
    const r = route({ id: "r1", method: "POST" });
    const facts = [fact({ id: "f1", kind: "api-route", snippet: "router.post('/')" })];
    expect(inferAuthState(r, facts, "analyzable")).toBe("missing");
  });

  it("GET route in parsed file without auth fact is missing", () => {
    const r = route({ id: "r1", method: "GET" });
    const facts = [fact({ id: "f1", kind: "api-route" })];
    expect(inferAuthState(r, facts, "analyzable")).toBe("missing");
  });

  it("auth-check fact yields confirmed", () => {
    const r = route({ id: "r1", method: "POST" });
    const facts = [fact({ id: "f1", kind: "auth-check", snippet: "requireAuth" })];
    expect(inferAuthState(r, facts, "analyzable")).toBe("confirmed");
  });

  it("comment mentioning auth does not yield confirmed", () => {
    const r = route({ id: "r1", method: "POST" });
    const facts = [fact({ id: "f1", kind: "api-route", snippet: "// TODO: add auth" })];
    expect(inferAuthState(r, facts, "analyzable")).toBe("partial");
  });

  it("validation state follows the same rules as auth state", () => {
    const r = route({ id: "r1", method: "POST" });
    expect(inferValidationState(r, [], "not-analyzable")).toBe("unknown");
    expect(
      inferValidationState(
        r,
        [fact({ id: "f1", kind: "api-route", snippet: "handler" })],
        "analyzable",
      ),
    ).toBe("missing");
    expect(
      inferValidationState(
        r,
        [fact({ id: "f1", kind: "validation-deny-400", snippet: "res.status(400)" })],
        "analyzable",
      ),
    ).toBe("confirmed");
  });
});

describe("buildRouteFactsIndexes analyzability", () => {
  it("marks routes analyzable only when their file has facts", () => {
    const routes = [
      route({ id: "a", method: "GET", filePath: "a.ts" }),
      route({ id: "b", method: "POST", filePath: "b.ts" }),
    ];
    const facts = [fact({ id: "f1", kind: "api-route", filePath: "a.ts" })];
    const indexes = buildRouteFactsIndexes(routes, facts);
    expect(indexes.analyzabilityByRouteId.get("a")).toBe("analyzable");
    expect(indexes.analyzabilityByRouteId.get("b")).toBe("not-analyzable");
  });
});
