/**
 * Shared projection types for graph-derived legacy Blueprint fields.
 */

type ConceptState = "confirmed" | "partial" | "weak" | "missing" | "unknown" | "contradictory";

type FindingSeverity = "info" | "low" | "medium" | "high" | "critical";

export interface ProjectedCodeFact {
  id: string;
  kind: string;
  filePath: string;
  line: number;
  snippet: string;
  metadata: Record<string, unknown>;
}

export interface ProjectedPipelineNode {
  id: string;
  type: string;
  label: string;
  state: ConceptState;
  filePath?: string;
  line?: number;
}

export interface ProjectedRoute {
  id: string;
  method: string;
  path: string;
  filePath: string;
  line: number;
  /** Deno pipeline steps when present on the route node; empty when unknown. */
  pipeline: ProjectedPipelineNode[];
  concepts: Record<string, ConceptState>;
}

export interface ProjectedSecurityMatrixRow {
  routeId: string;
  method: string;
  path: string;
  auth: { state: ConceptState | "n/a" };
  role: { state: ConceptState | "n/a" };
  validation: { state: ConceptState | "n/a" };
  rateLimit: { state: ConceptState | "n/a" };
  db: { state: ConceptState | "n/a" };
  rls: { state: ConceptState | "n/a" };
  audit: { state: ConceptState | "n/a" };
  findingCount: number;
}

export interface ProjectedFinding {
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
}

export type { ConceptState, FindingSeverity };
