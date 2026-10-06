/**
 * PU-01 contract tests — versioned model, identity, authoritative relations.
 * Location: shared/product-understanding/product-understanding.test.ts
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  buildProductConceptId,
  coerceProductConceptKind,
  emptyProductUnderstandingModel,
  isAuthoritativeProductRelation,
  isProductConceptKind,
  PRODUCT_CONCEPT_KINDS,
  PRODUCT_UNDERSTANDING_MODEL_VERSION,
  type ProductRelation,
  type ProductUnderstandingModel,
} from "./index.js";

const DIR = dirname(fileURLToPath(import.meta.url));

describe("product-understanding contracts", () => {
  it("exports a versioned empty model without React imports", () => {
    const model = emptyProductUnderstandingModel("proj-1", "2026-10-05T00:00:00.000Z");
    expect(model.version).toBe(PRODUCT_UNDERSTANDING_MODEL_VERSION);
    expect(model.version).toBe(1);
    expect(model.concepts).toEqual([]);
    expect(model.relations).toEqual([]);

    const entrySrc = readFileSync(join(DIR, "index.ts"), "utf8");
    const typesSrc = readFileSync(join(DIR, "../product-understanding.types.ts"), "utf8");
    expect(entrySrc).not.toMatch(/from ["']react/);
    expect(typesSrc).not.toMatch(/from ["']react/);
    expect(entrySrc).not.toMatch(/VITE_/);
  });

  it("covers required concept kinds including unknown", () => {
    for (const kind of [
      "application",
      "product-area",
      "capability",
      "information",
      "system-part",
      "external-system",
      "user-action",
      "unknown",
    ] as const) {
      expect(PRODUCT_CONCEPT_KINDS).toContain(kind);
      expect(isProductConceptKind(kind)).toBe(true);
    }
    expect(coerceProductConceptKind("not-a-kind")).toBe("unknown");
    expect(coerceProductConceptKind("capability")).toBe("capability");
  });

  it("builds deterministic concept identities", () => {
    expect(buildProductConceptId("product-area", "Billing")).toBe("pu:product-area:billing");
    expect(buildProductConceptId("user-action", "  Save Draft!! ")).toBe(
      "pu:user-action:save-draft",
    );
    expect(buildProductConceptId("unknown", "")).toBe("pu:unknown:unnamed");
  });

  it("rejects name-only relations as authoritative", () => {
    const nameOnly: ProductRelation = {
      id: "rel-1",
      kind: "uses",
      sourceConceptId: "pu:capability:a",
      targetConceptId: "pu:information:b",
      knowledgeStatus: "VERIFIED",
      confidence: 1,
      evidence: [],
    };
    expect(isAuthoritativeProductRelation(nameOnly)).toBe(false);

    const interpretedWithEvidence: ProductRelation = {
      ...nameOnly,
      knowledgeStatus: "INTERPRETED",
      evidence: [{ source: "semantic-system-model", refId: "semantic:capability:x" }],
    };
    expect(isAuthoritativeProductRelation(interpretedWithEvidence)).toBe(false);

    const supported: ProductRelation = {
      ...nameOnly,
      knowledgeStatus: "SUPPORTED",
      evidence: [{ source: "software-graph", refId: "edge:1", summary: "calls" }],
    };
    expect(isAuthoritativeProductRelation(supported)).toBe(true);
  });

  it("allows UNKNOWN/INTERPRETED concepts without inventing kinds", () => {
    const model: ProductUnderstandingModel = {
      ...emptyProductUnderstandingModel("proj-2", "2026-10-05T00:00:00.000Z"),
      concepts: [
        {
          id: buildProductConceptId("unknown", "orphan"),
          kind: "unknown",
          label: "Unclassified area",
          knowledgeStatus: "UNKNOWN",
          confidence: 0,
          evidence: [],
        },
        {
          id: buildProductConceptId("capability", "export"),
          kind: "capability",
          label: "Export",
          knowledgeStatus: "INTERPRETED",
          confidence: 0.4,
          evidence: [{ source: "scan", refId: "fact:1", summary: "label heuristic" }],
        },
      ],
    };
    expect(model.concepts[0]?.kind).toBe("unknown");
    expect(model.concepts[1]?.knowledgeStatus).toBe("INTERPRETED");
  });

  it("keeps Truth contract files untouched (source-compatible check)", () => {
    for (const relative of [
      "../software-graph.types.ts",
      "../semantic-system-model.types.ts",
      "../ui-interaction-graph.types.ts",
      "../data-lineage.types.ts",
    ]) {
      const src = readFileSync(join(DIR, relative), "utf8");
      expect(src.length).toBeGreaterThan(100);
      expect(src).not.toMatch(/ProductUnderstandingModel/);
    }
  });
});
