/**
 * SDE-07 projection / query layer tests — read models, evidence, limits, scope.
 */

import { describe, expect, it } from "vitest";
import {
  projectAppFlowReadModel,
  projectBlueprintReadModel,
  projectDataReadModel,
  type ScanEvidence,
  type ScanFact,
  type ScanSnapshot,
} from "./index.js";

function baseSnapshot(overrides?: Partial<ScanSnapshot>): ScanSnapshot {
  return {
    version: 1,
    projectId: "demo",
    analyzedAt: "2026-10-02T00:00:00.000Z",
    enrichment: "off",
    repo: { commitSha: "abc", branch: "main", dirty: false },
    versions: {
      engineVersion: "0.1.0-sde",
      modelVersions: {},
      detectorVersions: { "static-blueprint-graph-v1": "1.0.0" },
    },
    capabilities: [],
    facts: [],
    evidence: [],
    ...overrides,
  };
}

function fact(partial: Partial<ScanFact> & Pick<ScanFact, "id" | "kind" | "subjectId">): ScanFact {
  return {
    status: "detected",
    confidence: 1,
    provenance: { originKind: "static", detectorId: "test" },
    evidenceIds: [],
    ...partial,
  };
}

function evidence(
  partial: Partial<ScanEvidence> & Pick<ScanEvidence, "id" | "kind">,
): ScanEvidence {
  return {
    status: "detected",
    confidence: 1,
    provenance: { originKind: "static", detectorId: "test" },
    payload: {},
    ...partial,
  };
}

describe("projection query layer (SDE-07)", () => {
  it("builds a Blueprint read model with evidence backlinks and status", () => {
    const snapshot = baseSnapshot({
      facts: [
        fact({
          id: "fact:node:a",
          kind: "graph-node:module",
          subjectId: "a",
          evidenceIds: ["ev:a"],
          attributes: { label: "Module A" },
        }),
        fact({
          id: "fact:edge:a-b",
          kind: "graph-edge:imports",
          subjectId: "a",
          objectId: "b",
          evidenceIds: ["ev:edge"],
        }),
        fact({
          id: "fact:secret-skip",
          kind: "other:ignored",
          subjectId: "x",
        }),
      ],
      evidence: [
        evidence({
          id: "ev:a",
          kind: "graph-node",
          payload: { summary: "Module A", filePath: "src/a.ts", line: 1 },
        }),
        evidence({
          id: "ev:edge",
          kind: "graph-edge",
          payload: { summary: "imports" },
        }),
      ],
    });

    const model = projectBlueprintReadModel({
      snapshot,
      scope: { projectId: "demo" },
    });

    expect(model.slice).toBe("blueprint");
    expect(model.entities).toHaveLength(1);
    expect(model.entities[0]?.label).toBe("Module A");
    expect(model.entities[0]?.status).toBe("detected");
    expect(model.entities[0]?.evidence[0]?.evidenceId).toBe("ev:a");
    expect(model.entities[0]?.evidence[0]?.filePath).toBe("src/a.ts");
    expect(model.relations).toHaveLength(1);
    expect(model.relations[0]?.sourceId).toBe("a");
    expect(model.relations[0]?.targetId).toBe("b");
  });

  it("builds AppFlow and Data read models from classified fact kinds only", () => {
    const snapshot = baseSnapshot({
      facts: [
        fact({
          id: "f-screen",
          kind: "ui-screen:route",
          subjectId: "screen:/home",
          status: "observed",
          confidence: 0.9,
          evidenceIds: ["ev-screen"],
          attributes: { label: "Home" },
        }),
        fact({
          id: "f-flow",
          kind: "ui-flow:journey",
          subjectId: "flow:checkout",
          attributes: { label: "Checkout" },
        }),
        fact({
          id: "f-trans",
          kind: "ui-transition:nav",
          subjectId: "screen:/home",
          objectId: "screen:/cart",
        }),
        fact({
          id: "f-table",
          kind: "graph-node:table",
          subjectId: "table:users",
          status: "conflicted",
          confidence: 0.5,
          evidenceIds: ["ev-table"],
          attributes: { label: "users", token: "sk-abcdefghijklmnopqrstuvwxyz" },
        }),
        fact({
          id: "f-fk",
          kind: "data-relation:fk",
          subjectId: "table:orders",
          objectId: "table:users",
        }),
        // Must not be inferred into AppFlow just because the path looks like React.
        fact({
          id: "f-react-looking",
          kind: "graph-node:file",
          subjectId: "src/components/Button.tsx",
          attributes: { label: "Button.tsx" },
        }),
      ],
      evidence: [
        evidence({
          id: "ev-screen",
          kind: "runtime-screen",
          status: "observed",
          payload: { summary: "Home screen" },
        }),
        evidence({
          id: "ev-table",
          kind: "schema",
          status: "conflicted",
          payload: { summary: "users table" },
        }),
      ],
    });

    const appflow = projectAppFlowReadModel({
      snapshot,
      scope: { projectId: "demo" },
    });
    expect(appflow.screens).toHaveLength(1);
    expect(appflow.flows).toHaveLength(1);
    expect(appflow.transitions).toHaveLength(1);
    expect(appflow.screens[0]?.status).toBe("observed");
    expect(appflow.screens.some((s) => s.subjectId.includes("Button"))).toBe(false);

    const data = projectDataReadModel({
      snapshot,
      scope: { projectId: "demo" },
    });
    expect(data.tables).toHaveLength(1);
    expect(data.tables[0]?.status).toBe("conflicted");
    expect(data.tables[0]?.attributes?.token).toBe("[redacted]");
    expect(data.relations).toHaveLength(1);
  });

  it("supports progressive disclosure limits and preserves unknown when requested", () => {
    const facts: ScanFact[] = Array.from({ length: 5 }, (_, index) =>
      fact({
        id: `fact:node:${index}`,
        kind: "graph-node:module",
        subjectId: `n${index}`,
        status: index === 4 ? "unknown" : "detected",
        attributes: { label: `N${index}` },
      }),
    );
    const snapshot = baseSnapshot({ facts });

    const page0 = projectBlueprintReadModel({
      snapshot,
      scope: { projectId: "demo" },
      options: { limit: 2, offset: 0 },
    });
    expect(page0.entities).toHaveLength(2);
    expect(page0.page.total).toBe(5);
    expect(page0.page.hasMore).toBe(true);
    expect(page0.page.truncated).toBe(true);

    const withoutUnknown = projectBlueprintReadModel({
      snapshot,
      scope: { projectId: "demo" },
      options: { includeUnknown: false },
    });
    expect(withoutUnknown.entities).toHaveLength(4);
    expect(withoutUnknown.entities.every((entity) => entity.status !== "unknown")).toBe(true);
  });

  it("rejects mismatched project scope and filters by applicationId", () => {
    const snapshot = baseSnapshot({
      facts: [
        fact({
          id: "f1",
          kind: "graph-node:module",
          subjectId: "app:web/src/a",
          attributes: { applicationId: "app:web", label: "A" },
        }),
        fact({
          id: "f2",
          kind: "graph-node:module",
          subjectId: "app:api/src/b",
          attributes: { applicationId: "app:api", label: "B" },
        }),
      ],
    });

    expect(() =>
      projectBlueprintReadModel({
        snapshot,
        scope: { projectId: "other" },
      }),
    ).toThrow(/does not match snapshot/);

    const scoped = projectBlueprintReadModel({
      snapshot,
      scope: { projectId: "demo", applicationId: "app:web" },
    });
    expect(scoped.entities).toHaveLength(1);
    expect(scoped.entities[0]?.label).toBe("A");
  });

  it("returns empty honest models for empty snapshots", () => {
    const snapshot = baseSnapshot();
    const blueprint = projectBlueprintReadModel({
      snapshot,
      scope: { projectId: "demo" },
    });
    expect(blueprint.entities).toEqual([]);
    expect(blueprint.relations).toEqual([]);
    expect(blueprint.page.total).toBe(0);
    expect(blueprint.page.hasMore).toBe(false);

    const appflow = projectAppFlowReadModel({
      snapshot,
      scope: { projectId: "demo" },
    });
    expect(appflow.screens).toEqual([]);
    expect(appflow.flows).toEqual([]);

    const data = projectDataReadModel({
      snapshot,
      scope: { projectId: "demo" },
    });
    expect(data.tables).toEqual([]);
  });
});
