/**
 * Canonical cross-layer DataLineage read model (PR-21).
 * Runtime-neutral — no UI, no SQL profiler, no name-only joins.
 * Location: shared/data-lineage.types.ts
 */

import type { KnowledgeStatus } from "./scan-detector/epistemic.js";

export type DataLineageLayer =
  | "ui-surface"
  | "ui-interaction"
  | "endpoint"
  | "service-module"
  | "data-entity";

export interface LineageEntityRef {
  layer: DataLineageLayer;
  entityId: string;
  label: string;
}

export interface LineageHopEvidence {
  evidenceId: string;
  sourceIr: "ui" | "software-graph" | "data-graph" | "scan";
  kind: string;
  summary?: string;
  filePath?: string;
  line?: number;
}

export interface LineageHop {
  from: LineageEntityRef;
  to: LineageEntityRef;
  joinRuleId: string;
  knowledgeStatus: KnowledgeStatus;
  confidence: number;
  evidence: LineageHopEvidence[];
}

export type LineagePathStatus = "complete" | "partial" | "unresolved";

export interface DataLineagePath {
  id: string;
  status: LineagePathStatus;
  hops: LineageHop[];
  terminalHopIndex: number;
  truncationReason?: string;
}

export interface DataLineageGraph {
  version: 1;
  projectId: string;
  analyzedAt: string;
  paths: DataLineagePath[];
  stats: {
    pathCount: number;
    completeCount: number;
    partialCount: number;
    unresolvedCount: number;
  };
}
