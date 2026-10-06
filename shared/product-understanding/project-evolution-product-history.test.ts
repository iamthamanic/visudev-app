/**
 * PU-14: Evolution product-history projection tests.
 */
import { describe, expect, it } from "vitest";
import type { SoftwareGraphSnapshot } from "../software-graph.types.js";
import { PRODUCT_UNDERSTANDING_MODEL_VERSION } from "../product-understanding.types.js";
import type { ProductUnderstandingModel } from "../product-understanding.types.js";
import {
  diffProductUnderstandingHistory,
  projectEvolutionProductHistoryFromSnapshots,
  signaturesFromProductUnderstanding,
} from "./project-evolution-product-history.js";

function modelWithConcepts(
  concepts: ProductUnderstandingModel["concepts"],
): ProductUnderstandingModel {
  return {
    version: PRODUCT_UNDERSTANDING_MODEL_VERSION,
    projectId: "demo",
    analyzedAt: "2026-10-06T00:00:00.000Z",
    concepts,
    relations: [],
    impacts: [],
    stories: [],
    dataMeanings: [],
    explanations: [],
  };
}

describe("project-evolution-product-history", () => {
  it("groups concept add/remove/change with human copy", () => {
    const base = signaturesFromProductUnderstanding(
      modelWithConcepts([
        {
          id: "pu:product-area:leave",
          kind: "product-area",
          label: "Urlaub",
          knowledgeStatus: "SUPPORTED",
          confidence: 0.8,
          evidence: [{ source: "software-graph", refId: "n1" }],
        },
      ]),
    );
    const target = signaturesFromProductUnderstanding(
      modelWithConcepts([
        {
          id: "pu:product-area:leave",
          kind: "product-area",
          label: "Urlaub",
          knowledgeStatus: "VERIFIED",
          confidence: 0.9,
          evidence: [{ source: "software-graph", refId: "n1" }],
        },
        {
          id: "pu:capability:approve",
          kind: "capability",
          label: "Genehmigen",
          knowledgeStatus: "SUPPORTED",
          confidence: 0.7,
          evidence: [{ source: "software-graph", refId: "n2" }],
        },
      ]),
    );
    const diff = diffProductUnderstandingHistory(base, target);
    expect(diff.identical).toBe(false);
    expect(diff.totals.added).toBe(1);
    expect(diff.totals.changed).toBe(1);
    expect(diff.previewItems.some((item) => /Genehmigen/.test(item.summary))).toBe(true);
    expect(diff.groups.some((group) => /Fähigkeiten hinzugefügt/.test(group.title))).toBe(true);
  });

  it("projects graph snapshot signatures into product history", () => {
    const base: SoftwareGraphSnapshot = {
      id: "snap-a",
      label: "a",
      ref: "main",
      capturedAt: "2026-01-01T00:00:00.000Z",
      commitSha: "aaaaaaaa",
      nodeIds: ["e1"],
      nodeSignatures: { e1: "business-domain:Urlaub" },
      relationSignatures: {},
      engineVersion: "1.0.0",
    };
    const target: SoftwareGraphSnapshot = {
      id: "snap-b",
      label: "b",
      ref: "main",
      capturedAt: "2026-02-01T00:00:00.000Z",
      commitSha: "bbbbbbbb",
      nodeIds: ["e1", "e2"],
      nodeSignatures: {
        e1: "business-domain:Urlaub",
        e2: "capability:Genehmigen",
      },
      relationSignatures: {
        r1: "enables:e1->e2",
      },
      engineVersion: "1.0.0",
    };
    const projection = projectEvolutionProductHistoryFromSnapshots(base, target);
    expect(projection.comparable).toBe(true);
    expect(projection.totals.added).toBeGreaterThanOrEqual(1);
    expect(projection.previewItems.some((item) => item.changeKind === "capability")).toBe(true);
    expect(projection.evidence.targetCommitSha).toBe("bbbbbbbb");
  });

  it("refuses incompatible snapshots honestly", () => {
    const base: SoftwareGraphSnapshot = {
      id: "snap-a",
      label: "a",
      ref: "main",
      capturedAt: "2026-01-01T00:00:00.000Z",
      nodeIds: ["e1"],
      nodeSignatures: { e1: "capability:A" },
      engineVersion: "1.0.0",
    };
    const target: SoftwareGraphSnapshot = {
      id: "snap-b",
      label: "b",
      ref: "main",
      capturedAt: "2026-02-01T00:00:00.000Z",
      nodeIds: ["e1"],
      nodeSignatures: { e1: "capability:A" },
      engineVersion: "2.0.0",
    };
    const projection = projectEvolutionProductHistoryFromSnapshots(base, target);
    expect(projection.comparable).toBe(false);
    expect(projection.incompatibleReason).toMatch(/inkompatibel|Engine/i);
    expect(projection.groups).toHaveLength(0);
  });

  it("marks insufficient signatures as non-semantic compare", () => {
    const base: SoftwareGraphSnapshot = {
      id: "snap-a",
      label: "a",
      ref: "main",
      capturedAt: "2026-01-01T00:00:00.000Z",
      nodeIds: ["e1"],
      engineVersion: "1.0.0",
    };
    const target: SoftwareGraphSnapshot = {
      id: "snap-b",
      label: "b",
      ref: "main",
      capturedAt: "2026-02-01T00:00:00.000Z",
      nodeIds: ["e1"],
      engineVersion: "1.0.0",
    };
    const projection = projectEvolutionProductHistoryFromSnapshots(base, target);
    expect(projection.comparable).toBe(false);
    expect(projection.incompatibleReason).toMatch(/Unzureichend|kein Produktvergleich/i);
  });
});
