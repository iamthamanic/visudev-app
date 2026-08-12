/**
 * Neutral Software Graph IR for Blueprint v2.
 * Phase 0 scope: nodes, edges, evidence, groups, metrics only.
 * Snapshots, layouts, findings are reserved for later phases.
 */

export type SoftwareGraphScopeLevel =
  | "organization"
  | "application"
  | "domain"
  | "layer"
  | "module"
  | "file"
  | "symbol";

export interface SoftwareGraphScope {
  level: SoftwareGraphScopeLevel;
  id: string;
  label: string;
  parentId?: string;
}

export type SoftwareGraphNodeKind =
  | "organization"
  | "application"
  | "domain"
  | "layer"
  | "module"
  | "route"
  | "service"
  | "repository"
  | "table"
  | "external"
  | "file"
  | "symbol"
  | "runtime";

export type SoftwareGraphEdgeKind =
  | "contains"
  | "references"
  | "implements"
  | "imports"
  | "calls"
  | "api"
  | "event"
  | "data"
  | "external-dependency"
  | "validates"
  | "authenticates";

export interface SoftwareGraphNode {
  id: string;
  kind: SoftwareGraphNodeKind;
  label: string;
  scopeId?: string;
  filePath?: string;
  line?: number;
  /** Public metadata only; raw snippets are stored in evidence. */
  metadata: Record<string, unknown>;
}

export interface SoftwareGraphEdge {
  id: string;
  kind: SoftwareGraphEdgeKind;
  sourceId: string;
  targetId: string;
  metadata: Record<string, unknown>;
}

export interface SoftwareGraphEvidence {
  id: string;
  factId: string;
  kind: string;
  filePath: string;
  line: number;
  /** Sanitized excerpt; never raw metadata or full source lines. */
  excerpt: string;
  nodeId?: string;
  edgeId?: string;
}

export interface SoftwareGraphGroup {
  id: string;
  kind: SoftwareGraphNodeKind;
  label: string;
  nodeIds: string[];
}

export interface SoftwareGraphMetric {
  id: string;
  name: string;
  value: number;
}

export interface AnalysisOrigin {
  /** "git" when a real commit was read, "filesystem" otherwise. */
  sourceKind: "git" | "filesystem";
  /** Real short commit sha. Undefined when sourceKind is "filesystem". */
  commitSha?: string;
  /** Real branch name. Undefined on detached HEAD or without git. */
  branch?: string;
  /** True when the working tree has uncommitted changes. */
  dirty: boolean;
  /** ISO 8601 with milliseconds. Always set. */
  capturedAt: string;
}

export interface SoftwareGraphSnapshot {
  id: string;
  label: string;
  /** Commit SHA, branch name, or working-tree marker. */
  ref: string;
  capturedAt: string;
  nodeIds: string[];
  commitSha?: string;
  branch?: string;
  /** Optional for backwards-compatible demo snapshots. */
  sourceKind?: AnalysisOrigin["sourceKind"];
  /** Optional for backwards-compatible demo snapshots. */
  dirty?: boolean;
  /** kind:label signatures per node for change detection between snapshots. */
  nodeSignatures?: Record<string, string>;
}

export interface SoftwareGraphDiffMetadata {
  baseSnapshotId: string;
  targetSnapshotId: string;
  addedNodeIds: string[];
  removedNodeIds: string[];
  changedNodeIds: string[];
  identical: boolean;
  condensed: boolean;
}

export interface SoftwareGraph {
  version: 1;
  projectId: string;
  analyzedAt: string;
  scopes: SoftwareGraphScope[];
  nodes: SoftwareGraphNode[];
  edges: SoftwareGraphEdge[];
  evidence: SoftwareGraphEvidence[];
  groups: SoftwareGraphGroup[];
  metrics: SoftwareGraphMetric[];
  condensed: boolean;
  limits: { maxNodes: number; maxEdges: number };
  /** Historical scan snapshots for evolution compare. */
  snapshots?: SoftwareGraphSnapshot[];
}
