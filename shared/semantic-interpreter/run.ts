/**
 * Optional interpreter entry — skipped unless explicitly enabled.
 * Location: shared/semantic-interpreter/run.ts
 */

import type { SemanticSystemModel } from "../semantic-system-model.types.js";
import { mergeSemanticInterpretations } from "./merge.js";
import { createNullSemanticInterpreter } from "./null-provider.js";
import type {
  SemanticInterpretationResult,
  SemanticInterpreterPort,
  SemanticInterpreterInput,
} from "./types.js";
import { SEMANTIC_INTERPRETER_PROMPT_VERSION } from "./types.js";

type EnvMap = Record<string, string | undefined>;

export function isSemanticInterpreterEnabled(env: EnvMap = process.env): boolean {
  const raw = String(env.VISUDEV_SEMANTIC_INTERPRETER || "off").toLowerCase();
  return raw === "1" || raw === "true" || raw === "on" || raw === "optional";
}

function skippedResult(): SemanticInterpretationResult {
  return {
    status: "skipped",
    coverage: "UNAVAILABLE",
    reason: "SemanticInterpreter disabled (VISUDEV_SEMANTIC_INTERPRETER=off)",
    annotations: [],
    promptVersion: SEMANTIC_INTERPRETER_PROMPT_VERSION,
  };
}

/**
 * Sync path for blueprint enrichment (default off / null provider).
 * Real HTTP providers should use `runSemanticInterpreter` asynchronously.
 */
export function runSemanticInterpreterSync(options: {
  model: SemanticSystemModel;
  redactedEvidence?: SemanticInterpreterInput["redactedEvidence"];
  env?: EnvMap;
}): { model: SemanticSystemModel; interpretation: SemanticInterpretationResult } {
  const env = options.env || process.env;
  if (!isSemanticInterpreterEnabled(env)) {
    return { model: options.model, interpretation: skippedResult() };
  }
  // Default optional mode without a wired provider → UNAVAILABLE only.
  return {
    model: options.model,
    interpretation: {
      status: "unavailable",
      coverage: "UNAVAILABLE",
      reason: "No SemanticInterpreter provider configured",
      annotations: [],
      promptVersion: SEMANTIC_INTERPRETER_PROMPT_VERSION,
    },
  };
}

export async function runSemanticInterpreter(options: {
  model: SemanticSystemModel;
  redactedEvidence?: SemanticInterpreterInput["redactedEvidence"];
  provider?: SemanticInterpreterPort;
  env?: EnvMap;
}): Promise<{ model: SemanticSystemModel; interpretation: SemanticInterpretationResult }> {
  const env = options.env || process.env;
  if (!isSemanticInterpreterEnabled(env)) {
    return { model: options.model, interpretation: skippedResult() };
  }

  const provider = options.provider || createNullSemanticInterpreter();
  let interpretation: SemanticInterpretationResult;
  try {
    interpretation = await provider.interpret({
      model: options.model,
      redactedEvidence: options.redactedEvidence || [],
      promptVersion: SEMANTIC_INTERPRETER_PROMPT_VERSION,
    });
  } catch (error) {
    interpretation = {
      status: "unavailable",
      coverage: "UNAVAILABLE",
      reason: error instanceof Error ? error.message : String(error),
      annotations: [],
      promptVersion: SEMANTIC_INTERPRETER_PROMPT_VERSION,
    };
  }

  if (interpretation.status !== "ok") {
    return { model: options.model, interpretation };
  }

  return {
    model: mergeSemanticInterpretations(options.model, interpretation),
    interpretation,
  };
}
