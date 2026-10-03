/**
 * Canonical DataGraph IR (SDE-12).
 * database / schema / table / column / relation / policy — no raw row samples.
 * Location: shared/data-graph.types.ts
 */

export type DataKnowledgeStatus =
  | "detected"
  | "inferred"
  | "observed"
  | "verified"
  | "conflicted"
  | "unknown";

export type DataEvidenceOrigin =
  | "static"
  | "runtime"
  | "migration"
  | "live"
  | "heuristic"
  | "merged";

export type DataProvenanceKind = "migration" | "live" | "unknown";

export interface DataEvidenceRef {
  id: string;
  kind: string;
  status: DataKnowledgeStatus;
  origin: DataEvidenceOrigin;
  confidence: number;
  /** Redacted summary — never credentials or policy secrets. */
  summary: string;
  filePath?: string;
  line?: number;
  attributes?: Record<string, string | number | boolean | null>;
}

export interface DataDatabase {
  id: string;
  label: string;
  dialect?: string;
  provenance: DataProvenanceKind;
  status: DataKnowledgeStatus;
  confidence: number;
  evidenceIds: string[];
  attributes?: Record<string, string | number | boolean | null>;
}

export interface DataSchemaNode {
  id: string;
  databaseId: string;
  name: string;
  provenance: DataProvenanceKind;
  status: DataKnowledgeStatus;
  confidence: number;
  evidenceIds: string[];
}

export interface DataColumn {
  id: string;
  tableId: string;
  name: string;
  dataType?: string;
  nullable?: boolean;
  /** Default expression redacted if secret-like. */
  defaultValue?: string;
  status: DataKnowledgeStatus;
  confidence: number;
  evidenceIds: string[];
}

export interface DataTable {
  id: string;
  schemaId: string;
  name: string;
  label: string;
  provenance: DataProvenanceKind;
  status: DataKnowledgeStatus;
  confidence: number;
  evidenceIds: string[];
  columnIds: string[];
  attributes?: Record<string, string | number | boolean | null>;
}

export interface DataRelation {
  id: string;
  kind: "fk" | "references" | "unknown";
  fromTableId: string;
  toTableId: string;
  fromColumn?: string;
  toColumn?: string;
  status: DataKnowledgeStatus;
  confidence: number;
  evidenceIds: string[];
}

/** RLS / policy stubs — expressions redacted; never store secrets. */
export interface DataPolicy {
  id: string;
  tableId: string;
  name: string;
  /** true when a policy exists; expression text is never persisted here. */
  hasExpression: boolean;
  status: DataKnowledgeStatus;
  confidence: number;
  evidenceIds: string[];
  attributes?: Record<string, string | number | boolean | null>;
}

export interface DataGraph {
  version: 1;
  projectId: string;
  analyzedAt: string;
  databases: DataDatabase[];
  schemas: DataSchemaNode[];
  tables: DataTable[];
  columns: DataColumn[];
  relations: DataRelation[];
  policies: DataPolicy[];
  evidence: DataEvidenceRef[];
  stats: {
    databaseCount: number;
    schemaCount: number;
    tableCount: number;
    columnCount: number;
    relationCount: number;
    policyCount: number;
    conflictCount: number;
  };
}

/** Legacy ERD-shaped input for adapters / compatibility projection. */
export interface LegacyErdColumn {
  name: string;
  type?: string;
  nullable?: boolean;
  default?: string;
}

export interface LegacyErdTable {
  id: string;
  name?: string;
  label?: string;
  columns?: LegacyErdColumn[];
  rls?: unknown;
  /** Sample rows are never promoted into DataGraph. */
  sample?: unknown;
  schema?: string;
  databaseId?: string;
}

export interface LegacyErdRelation {
  id: string;
  fromTable: string;
  toTable: string;
  fromColumn?: string;
  toColumn?: string;
}

export interface LegacyErdSnapshot {
  projectId: string;
  nodes?: LegacyErdTable[];
  tables?: LegacyErdTable[];
  edges?: LegacyErdRelation[];
  dialect?: string;
  source?: string;
  message?: string;
  updatedAt?: string;
}
