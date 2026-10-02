/**
 * Canonical Projection / Query read-model contracts (SDE-07).
 * Product slices consume these types — never detector/orchestrator internals.
 * Location: shared/scan-detector/domain/projection/types.ts
 */

import type { ScanConfidence, ScanKnowledgeStatus } from "../../types.js";

/** Product-facing projection slices. */
export type ProjectionSlice = "blueprint" | "appflow" | "data";

/**
 * Query scope — must respect project / application boundaries.
 * Projections never invent scope; callers pass it explicitly.
 */
export interface ProjectionQueryScope {
  projectId: string;
  /** Optional monorepo application id (e.g. `app:apps/web`). */
  applicationId?: string;
  /** Optional subject-id prefix filter for strict boundary cuts. */
  subjectIdPrefix?: string;
}

/** Progressive disclosure / pagination options. */
export interface ProjectionQueryOptions {
  /** Max entities returned (default 200, hard max 2000). */
  limit?: number;
  /** Zero-based offset into the filtered entity list. */
  offset?: number;
  /** Include facts with status `unknown` (default true). */
  includeUnknown?: boolean;
  /** Include facts with status `conflicted` (default true). */
  includeConflicted?: boolean;
}

export interface ProjectionPageMeta {
  total: number;
  returned: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  /** True when callers requested more than the hard max or result was capped. */
  truncated: boolean;
}

/**
 * Evidence backlink for UI inspectors.
 * Never re-exposes redacted engine-internal or secret payloads.
 */
export interface ProjectionEvidenceLink {
  evidenceId: string;
  kind: string;
  status: ScanKnowledgeStatus;
  confidence: ScanConfidence;
  summary?: string;
  filePath?: string;
  line?: number;
}

/** View-neutral projected entity (node / screen / table / …). */
export interface ProjectionEntity {
  id: string;
  kind: string;
  label: string;
  status: ScanKnowledgeStatus;
  confidence: ScanConfidence;
  subjectId: string;
  factIds: string[];
  evidence: ProjectionEvidenceLink[];
  /** Safe soft attributes only — never secrets. */
  attributes?: Record<string, string | number | boolean | null>;
}

/** View-neutral projected relation / edge / transition. */
export interface ProjectionRelation {
  id: string;
  kind: string;
  sourceId: string;
  targetId: string;
  status: ScanKnowledgeStatus;
  confidence: ScanConfidence;
  factIds: string[];
  evidence: ProjectionEvidenceLink[];
}

interface ProjectionReadModelBase {
  version: 1;
  slice: ProjectionSlice;
  projectId: string;
  analyzedAt: string;
  scope: ProjectionQueryScope;
  page: ProjectionPageMeta;
}

/** Blueprint read model — software / semantic graph projection. */
export interface BlueprintProjectionReadModel extends ProjectionReadModelBase {
  slice: "blueprint";
  entities: ProjectionEntity[];
  relations: ProjectionRelation[];
}

/** AppFlow read model — screens, flows, transitions. */
export interface AppFlowProjectionReadModel extends ProjectionReadModelBase {
  slice: "appflow";
  screens: ProjectionEntity[];
  flows: ProjectionEntity[];
  transitions: ProjectionRelation[];
}

/** Data read model — tables and data relations. */
export interface DataProjectionReadModel extends ProjectionReadModelBase {
  slice: "data";
  tables: ProjectionEntity[];
  relations: ProjectionRelation[];
}

export type ProjectionReadModel =
  | BlueprintProjectionReadModel
  | AppFlowProjectionReadModel
  | DataProjectionReadModel;

/** Default / hard caps for progressive disclosure. */
export const PROJECTION_DEFAULT_LIMIT = 200;
export const PROJECTION_HARD_MAX_LIMIT = 2000;
