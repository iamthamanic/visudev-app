/**
 * Optional LLM SemanticInterpreter contracts (PR-19).
 * Location: shared/semantic-interpreter/types.ts
 */

import type { CoverageStatus, KnowledgeStatus } from "../scan-detector/epistemic.js";
import type {
  SemanticEvidenceRef,
  SemanticEntity,
  SemanticSystemModel,
} from "../semantic-system-model.types.js";

/** Prompt contract version — bump when interpreter prompt/schema changes. */
export const SEMANTIC_INTERPRETER_PROMPT_VERSION = "semantic-interpreter-v1";

export interface SemanticInterpretationProvenance {
  originKind: "llm";
  /** LLM claims are INTERPRETED; CONFLICTED only when already conflicted. */
  knowledgeStatus: "INTERPRETED" | "CONFLICTED";
  modelId: string;
  promptVersion: string;
  evidence: SemanticEvidenceRef[];
}

export interface SemanticInterpretationAnnotation {
  /** Target existing entity id, or a new INTERPRETED-only entity id. */
  entityId: string;
  /** Optional label/kind patch — never applied onto VERIFIED/SUPPORTED entities. */
  label?: string;
  kind?: SemanticEntity["kind"];
  confidence: number;
  provenance: SemanticInterpretationProvenance;
  /** Free-form interpretation note (German UI may surface later). */
  note?: string;
}

export type SemanticInterpretationRunStatus = "ok" | "unavailable" | "skipped";

export interface SemanticInterpretationResult {
  status: SemanticInterpretationRunStatus;
  coverage: CoverageStatus;
  reason?: string;
  annotations: SemanticInterpretationAnnotation[];
  modelId?: string;
  promptVersion?: string;
}

export interface SemanticInterpreterInput {
  model: SemanticSystemModel;
  /** Redacted evidence snippets only — never secrets. */
  redactedEvidence: Array<{ refId: string; text: string }>;
  modelId?: string;
  promptVersion?: string;
}

export interface SemanticInterpreterPort {
  interpret(input: SemanticInterpreterInput): Promise<SemanticInterpretationResult>;
}

export type { KnowledgeStatus, CoverageStatus, SemanticSystemModel };
