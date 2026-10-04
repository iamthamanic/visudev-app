/**
 * Optional LLM SemanticInterpreter (PR-19) — public exports.
 * Location: shared/semantic-interpreter/index.ts
 */

export {
  SEMANTIC_INTERPRETER_PROMPT_VERSION,
  type SemanticInterpretationAnnotation,
  type SemanticInterpretationProvenance,
  type SemanticInterpretationResult,
  type SemanticInterpretationRunStatus,
  type SemanticInterpreterInput,
  type SemanticInterpreterPort,
} from "./types.js";
export { mergeSemanticInterpretations } from "./merge.js";
export { NullSemanticInterpreter, createNullSemanticInterpreter } from "./null-provider.js";
export {
  isSemanticInterpreterEnabled,
  runSemanticInterpreter,
  runSemanticInterpreterSync,
} from "./run.js";
