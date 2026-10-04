/**
 * Default SemanticInterpreter — always UNAVAILABLE (no provider lock-in).
 * Location: shared/semantic-interpreter/null-provider.ts
 */

import type { SemanticInterpreterPort, SemanticInterpretationResult } from "./types.js";
import { SEMANTIC_INTERPRETER_PROMPT_VERSION } from "./types.js";

export class NullSemanticInterpreter implements SemanticInterpreterPort {
  async interpret(): Promise<SemanticInterpretationResult> {
    return {
      status: "unavailable",
      coverage: "UNAVAILABLE",
      reason: "No SemanticInterpreter provider configured",
      annotations: [],
      promptVersion: SEMANTIC_INTERPRETER_PROMPT_VERSION,
    };
  }
}

export function createNullSemanticInterpreter(): SemanticInterpreterPort {
  return new NullSemanticInterpreter();
}
