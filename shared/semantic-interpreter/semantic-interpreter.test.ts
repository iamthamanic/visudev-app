/**
 * SemanticInterpreter merge + optional run contract (PR-19).
 * Location: shared/semantic-interpreter/semantic-interpreter.test.ts
 */

import { describe, expect, it } from "vitest";
import type { SemanticSystemModel } from "../semantic-system-model.types.js";
import { mergeSemanticInterpretations } from "./merge.js";
import { createNullSemanticInterpreter } from "./null-provider.js";
import { isSemanticInterpreterEnabled, runSemanticInterpreter } from "./run.js";
import type { SemanticInterpreterPort } from "./types.js";
import { SEMANTIC_INTERPRETER_PROMPT_VERSION } from "./types.js";

function baseModel(): SemanticSystemModel {
  return {
    version: 2,
    projectId: "demo",
    analyzedAt: "2026-10-04T00:00:00.000Z",
    entities: [
      {
        id: "ent-verified",
        kind: "service",
        label: "Billing",
        confidence: 0.95,
        knowledgeStatus: "VERIFIED",
        evidence: [{ source: "graph-node", refId: "n1" }],
        metadata: {},
      },
      {
        id: "ent-supported",
        kind: "endpoint",
        label: "GET /pay",
        confidence: 0.8,
        knowledgeStatus: "SUPPORTED",
        evidence: [{ source: "graph-node", refId: "n2" }],
        metadata: {},
      },
    ],
    memberships: [],
    relations: [],
  };
}

describe("semantic interpreter", () => {
  it("is disabled by default so deterministic analysis is unchanged", async () => {
    expect(isSemanticInterpreterEnabled({})).toBe(false);
    const model = baseModel();
    const result = await runSemanticInterpreter({
      model,
      env: {},
      provider: createNullSemanticInterpreter(),
    });
    expect(result.interpretation.status).toBe("skipped");
    expect(result.model).toEqual(model);
  });

  it("null provider reports UNAVAILABLE without mutating the model", async () => {
    const model = baseModel();
    const result = await runSemanticInterpreter({
      model,
      env: { VISUDEV_SEMANTIC_INTERPRETER: "optional" },
      provider: createNullSemanticInterpreter(),
    });
    expect(result.interpretation.status).toBe("unavailable");
    expect(result.interpretation.coverage).toBe("UNAVAILABLE");
    expect(result.model).toEqual(model);
  });

  it("never overwrites VERIFIED/SUPPORTED entities", () => {
    const merged = mergeSemanticInterpretations(baseModel(), {
      status: "ok",
      coverage: "PARTIAL",
      annotations: [
        {
          entityId: "ent-verified",
          label: "Hacked by LLM",
          confidence: 0.99,
          provenance: {
            originKind: "llm",
            knowledgeStatus: "INTERPRETED",
            modelId: "test-model",
            promptVersion: SEMANTIC_INTERPRETER_PROMPT_VERSION,
            evidence: [{ source: "graph-evidence", refId: "ev1" }],
          },
        },
        {
          entityId: "ent-supported",
          label: "Also hacked",
          confidence: 0.99,
          provenance: {
            originKind: "llm",
            knowledgeStatus: "INTERPRETED",
            modelId: "test-model",
            promptVersion: SEMANTIC_INTERPRETER_PROMPT_VERSION,
            evidence: [{ source: "graph-evidence", refId: "ev2" }],
          },
        },
        {
          entityId: "ent-new",
          label: "Optional capability",
          kind: "capability",
          confidence: 0.4,
          provenance: {
            originKind: "llm",
            knowledgeStatus: "INTERPRETED",
            modelId: "test-model",
            promptVersion: SEMANTIC_INTERPRETER_PROMPT_VERSION,
            evidence: [{ source: "graph-evidence", refId: "ev3" }],
          },
        },
      ],
    });

    expect(merged.entities.find((entity) => entity.id === "ent-verified")?.label).toBe("Billing");
    expect(merged.entities.find((entity) => entity.id === "ent-verified")?.knowledgeStatus).toBe(
      "VERIFIED",
    );
    expect(merged.entities.find((entity) => entity.id === "ent-supported")?.label).toBe("GET /pay");
    expect(merged.entities.find((entity) => entity.id === "ent-supported")?.knowledgeStatus).toBe(
      "SUPPORTED",
    );
    const created = merged.entities.find((entity) => entity.id === "ent-new");
    expect(created?.knowledgeStatus).toBe("INTERPRETED");
    expect(created?.metadata.originKind).toBe("llm");
    expect(created?.metadata.modelId).toBe("test-model");
    expect(created?.metadata.promptVersion).toBe(SEMANTIC_INTERPRETER_PROMPT_VERSION);
  });

  it("provider throw becomes UNAVAILABLE only", async () => {
    const failing: SemanticInterpreterPort = {
      async interpret() {
        throw new Error("provider offline");
      },
    };
    const model = baseModel();
    const result = await runSemanticInterpreter({
      model,
      env: { VISUDEV_SEMANTIC_INTERPRETER: "on" },
      provider: failing,
    });
    expect(result.interpretation.status).toBe("unavailable");
    expect(result.interpretation.reason).toMatch(/offline/i);
    expect(result.model).toEqual(model);
  });

  it("forces LLM provenance to INTERPRETED even if annotation claims VERIFIED", () => {
    const hostile = {
      entityId: "ent-llm",
      label: "Guess",
      confidence: 0.7,
      provenance: {
        originKind: "llm" as const,
        knowledgeStatus: "VERIFIED",
        modelId: "x",
        promptVersion: "p",
        evidence: [],
      },
    };
    const merged = mergeSemanticInterpretations(baseModel(), {
      status: "ok",
      coverage: "PARTIAL",
      annotations: [hostile as never],
    });
    expect(merged.entities.find((entity) => entity.id === "ent-llm")?.knowledgeStatus).toBe(
      "INTERPRETED",
    );
  });
});
