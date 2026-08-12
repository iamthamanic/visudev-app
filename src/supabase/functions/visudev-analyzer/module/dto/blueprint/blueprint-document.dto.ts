/** Blueprint Engine IR — neutral analysis model (VisuDEV analyzer module). */

import type { VisuDevGraph } from "../graph/visudev-graph.dto.ts";

export type ConceptType =
  | "api-route"
  | "auth-gate"
  | "role-gate"
  | "validation-gate"
  | "rate-limit"
  | "db-read"
  | "db-write"
  | "storage-access"
  | "external-api"
  | "audit-log"
  /** @deprecated Prefer AccessControlFinding tenant-isolation / resource-scope. */
  | "rls-policy";

export type ConceptState =
  | "confirmed"
  | "partial"
  | "weak"
  | "missing"
  | "unknown"
  | "contradictory";

export type FindingCategory =
  | "security"
  | "scalability"
  | "data"
  | "architecture"
  | "maintainability";

export type FindingSeverity = "info" | "low" | "medium" | "high" | "critical";

export interface CodeFact {
  id: string;
  kind: string;
  filePath: string;
  line: number;
  snippet: string;
  metadata: Record<string, unknown>;
}

export interface TechnicalConcept {
  id: string;
  type: ConceptType;
  state: ConceptState;
  confidence: number;
  scopeId: string;
  evidenceFactIds: string[];
  callPath?: string[];
}

export interface BlueprintFinding {
  id: string;
  ruleId: string;
  category: FindingCategory;
  severity: FindingSeverity;
  scopeId: string;
  message: string;
  expectedState: string;
  actualState: string;
  evidenceFactIds: string[];
  confidence: number;
  remediation?: string;
}

export interface PipelineNode {
  id: string;
  type: ConceptType | "request" | "handler" | "unknown";
  label: string;
  state: ConceptState;
  filePath?: string;
  line?: number;
}

export interface RouteBlueprint {
  id: string;
  method: string;
  path: string;
  filePath: string;
  line: number;
  pipeline: PipelineNode[];
  concepts: Partial<Record<ConceptType, ConceptState>>;
}

export interface SecurityMatrixCell {
  state: ConceptState | "n/a";
}

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

export interface ProjectProfile {
  appType: "saas" | "internal" | "desktop" | "mobile";
  expectedUsers: "small" | "medium" | "large";
  dataSensitivity: "low" | "pii" | "financial" | "health";
  deployment: "vercel" | "self-hosted" | "edge";
}

export interface FactSelectionReport {
  /** Facts produced by the extractors before any cap. */
  extracted: number;
  /** Facts included in the export. */
  selected: number;
  /** Files with at least one selected fact. */
  filesCovered: number;
  /** Per kind: extracted vs selected. */
  byKind: Record<string, { extracted: number; selected: number }>;
}

export interface BlueprintDocument {
  version: 1;
  projectId?: string;
  repo: string;
  branch: string;
  commitSha: string;
  analyzedAt: string;
  projectProfile: ProjectProfile;
  routes: RouteBlueprint[];
  securityMatrix: SecurityMatrixRow[];
  findings: BlueprintFinding[];
  facts: CodeFact[];
  factSelection?: FactSelectionReport;
  concepts: TechnicalConcept[];
  graph?: VisuDevGraph;
  filesAnalyzed: number;
  frameworkHints: string[];
}

export interface BlueprintAnalysisRequestDto {
  access_token?: string;
  repo: string;
  branch: string;
  projectId: string;
}

export interface BlueprintAnalysisResultDto {
  blueprint: BlueprintDocument;
  analysisId: string;
}
