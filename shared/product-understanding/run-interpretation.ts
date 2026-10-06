/**
 * Optional async Product Understanding interpretation runner (PU-03 / #424).
 * Location: shared/product-understanding/run-interpretation.ts
 */

import type { ProductUnderstandingModel } from "../product-understanding.types.js";
import {
  buildProductUnderstandingInterpreterInput,
  createNullProductUnderstandingInterpreter,
  mergeProductUnderstandingInterpretations,
  PRODUCT_UNDERSTANDING_INTERPRETER_PROMPT_VERSION,
  type ProductUnderstandingInterpretationResult,
  type ProductUnderstandingInterpreterPort,
} from "./interpretation.js";

type EnvMap = Record<string, string | undefined>;

export function isProductUnderstandingInterpreterEnabled(env: EnvMap = process.env): boolean {
  const raw = String(env.VISUDEV_PRODUCT_UNDERSTANDING_INTERPRETER || "off").toLowerCase();
  return raw === "1" || raw === "true" || raw === "on" || raw === "optional";
}

function skippedResult(): ProductUnderstandingInterpretationResult {
  return {
    status: "skipped",
    coverage: "UNAVAILABLE",
    reason: "ProductUnderstanding interpreter disabled",
    annotations: [],
    promptVersion: PRODUCT_UNDERSTANDING_INTERPRETER_PROMPT_VERSION,
  };
}

/**
 * Enrich a deterministic ProductUnderstandingModel. Disabled → byte-stable identity.
 * Provider/parse failures → UNAVAILABLE, model unchanged.
 */
export async function runProductUnderstandingInterpretation(options: {
  model: ProductUnderstandingModel;
  provider?: ProductUnderstandingInterpreterPort;
  env?: EnvMap;
}): Promise<{
  model: ProductUnderstandingModel;
  interpretation: ProductUnderstandingInterpretationResult;
}> {
  const env = options.env || process.env;
  if (!isProductUnderstandingInterpreterEnabled(env)) {
    return { model: options.model, interpretation: skippedResult() };
  }

  const input = buildProductUnderstandingInterpreterInput(options.model);
  if (input.ambiguousConceptIds.length === 0) {
    return {
      model: options.model,
      interpretation: {
        status: "skipped",
        coverage: "COMPLETE",
        reason: "No ambiguous Product Understanding concepts",
        annotations: [],
        promptVersion: PRODUCT_UNDERSTANDING_INTERPRETER_PROMPT_VERSION,
      },
    };
  }

  const provider = options.provider || createNullProductUnderstandingInterpreter();
  let interpretation: ProductUnderstandingInterpretationResult;
  try {
    interpretation = await provider.interpret(input);
  } catch (error) {
    interpretation = {
      status: "unavailable",
      coverage: "UNAVAILABLE",
      reason: error instanceof Error ? error.message : String(error),
      annotations: [],
      promptVersion: PRODUCT_UNDERSTANDING_INTERPRETER_PROMPT_VERSION,
    };
  }

  if (interpretation.status !== "ok") {
    return { model: options.model, interpretation };
  }

  return {
    model: mergeProductUnderstandingInterpretations(options.model, interpretation),
    interpretation,
  };
}
