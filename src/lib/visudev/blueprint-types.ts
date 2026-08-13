/** Blueprint Engine types — shared lib layer for UI and normalization. */

import type { SoftwareGraph } from "./software-graph-types";
import type { AccessControlFinding, AccessControlMatrixRow } from "./access-control-types";

export type ConceptState =
  | "confirmed"
  | "partial"
  | "weak"
  | "missing"
  | "unknown"
  | "contradictory";

export type FindingSeverity = "info" | "low" | "medium" | "high" | "critical";

/** @deprecated Synthesized from `graph`; kept for one major version. */
export interface BlueprintFinding {
  id: string;
  ruleId: string;
  category: string;
  severity: FindingSeverity;
  scopeId: string;
  message: string;
  expectedState: string;
  actualState: string;
  evidenceFactIds: string[];
  confidence: number;
  remediation?: string;
}

/** @deprecated Synthesized from `graph`; kept for one major version. */
export interface CodeFact {
  id: string;
  kind: string;
  filePath: string;
  line: number;
  snippet: string;
  metadata: Record<string, unknown>;
}

export interface PipelineNode {
  id: string;
  type: string;
  label: string;
  state: ConceptState;
  filePath?: string;
  line?: number;
}

/** @deprecated Synthesized from `graph`; kept for one major version. */
export interface RouteBlueprint {
  id: string;
  method: string;
  path: string;
  filePath: string;
  line: number;
  pipeline: PipelineNode[];
  concepts: Record<string, ConceptState>;
}

/** @deprecated Prefer `graph` + `deriveDiagnosticsFromGraph`; kept for one major version. */
export interface SecurityMatrixCell {
  state: ConceptState | "n/a";
}

/** @deprecated Prefer `graph` + `deriveDiagnosticsFromGraph`; kept for one major version. */
export interface SecurityMatrixRow {
  routeId: string;
  method: string;
  path: string;
  auth: SecurityMatrixCell;
  role: SecurityMatrixCell;
  validation: SecurityMatrixCell;
  rateLimit: SecurityMatrixCell;
  db: SecurityMatrixCell;
  rls: SecurityMatrixCell;
  audit: SecurityMatrixCell;
  findingCount: number;
}

/** dependency-cruiser-style rule violation (legacy optional). */
export interface RuleViolation {
  ruleId: string;
  severity: "error" | "warn" | "info";
  source: string;
  target?: string;
  message: string;
}

export interface BlueprintCycle {
  nodes: string[];
  message?: string;
}

export interface BlueprintData extends Record<string, unknown> {
  version?: 1;
  projectId?: string;
  updatedAt?: string;
  commitSha?: string;
  analyzedAt?: string;
  /** @deprecated Synthesized from `graph` when absent. */
  routes?: RouteBlueprint[];
  /** @deprecated Synthesized from `graph` when absent. */
  securityMatrix?: SecurityMatrixRow[];
  /** Stack-agnostic access control assessments (Diagnostics v3+). */
  accessControlFindings?: AccessControlFinding[];
  /** Route matrix derived from `accessControlFindings`. */
  accessControlMatrix?: AccessControlMatrixRow[];
  /** @deprecated Synthesized from `graph` when absent. */
  findings?: BlueprintFinding[];
  /** @deprecated Synthesized from `graph` when absent. */
  facts?: CodeFact[];
  filesAnalyzed?: number;
  /** Total files in the repo, when known. Drives the partial-scan banner (P0-1). */
  totalFiles?: number;
  frameworkHints?: string[];
  violations?: RuleViolation[];
  cycles?: BlueprintCycle[];
  graph?: SoftwareGraph;
}

export type BlueprintUpdateInput = Record<string, unknown>;

export function cellSymbol(state: ConceptState | "n/a" | undefined): string {
  if (!state || state === "unknown") return "?";
  if (state === "confirmed") return "✓";
  if (state === "missing" || state === "contradictory") return "✕";
  if (state === "partial" || state === "weak") return "~";
  return "?";
}
