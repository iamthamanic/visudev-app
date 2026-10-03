/**
 * Adapt legacy ERD snapshot → DataGraph (SDE-12).
 * Sample rows are dropped; RLS expressions redacted to hasExpression only.
 * Location: shared/scan-detector/application/adapt-erd-to-data-graph.ts
 */

import type {
  DataColumn,
  DataDatabase,
  DataEvidenceRef,
  DataGraph,
  DataPolicy,
  DataRelation,
  DataSchemaNode,
  DataTable,
  DataProvenanceKind,
  LegacyErdSnapshot,
} from "../../data-graph.types.js";

export interface AdaptErdToDataGraphInput {
  erd: LegacyErdSnapshot;
  detectorId?: string;
  analyzedAt?: string;
}

function provenanceFromSource(source: string | undefined): DataProvenanceKind {
  const normalized = (source || "").toLowerCase();
  if (normalized.includes("migration") || normalized.includes("prisma")) return "migration";
  if (normalized.includes("live") || normalized.includes("introspect")) return "live";
  return "unknown";
}

function redactDefault(value: string | undefined): string | undefined {
  if (!value) return undefined;
  if (/(password|secret|token|api[_-]?key)/i.test(value)) return "[redacted]";
  return value;
}

/**
 * Convert ERD introspection/migration snapshot into canonical DataGraph.
 */
export function adaptErdToDataGraph(input: AdaptErdToDataGraphInput): DataGraph {
  const detectorId = input.detectorId ?? "schema-data-detector-v1";
  const erd = input.erd;
  const analyzedAt = input.analyzedAt ?? erd.updatedAt ?? new Date().toISOString();
  const tablesIn = Array.isArray(erd.tables)
    ? erd.tables
    : Array.isArray(erd.nodes)
      ? erd.nodes
      : [];
  const provenance = provenanceFromSource(erd.source);
  const evidence: DataEvidenceRef[] = [];
  const databases: DataDatabase[] = [];
  const schemas: DataSchemaNode[] = [];
  const tables: DataTable[] = [];
  const columns: DataColumn[] = [];
  const relations: DataRelation[] = [];
  const policies: DataPolicy[] = [];

  const databaseIds = new Set<string>();
  const schemaKeys = new Set<string>();

  for (const table of tablesIn) {
    const databaseId = table.databaseId?.trim() || "db:default";
    const schemaName = table.schema?.trim() || "public";
    const schemaId = `${databaseId}:schema:${schemaName}`;

    if (!databaseIds.has(databaseId)) {
      databaseIds.add(databaseId);
      const evidenceId = `data:ev:database:${databaseId}`;
      evidence.push({
        id: evidenceId,
        kind: "data-database",
        status: "detected",
        origin:
          provenance === "live" ? "live" : provenance === "migration" ? "migration" : "static",
        confidence: 0.85,
        summary: `Database ${databaseId}`,
        attributes: {
          dialect: erd.dialect ?? null,
          provenance,
          detectorId,
        },
      });
      databases.push({
        id: databaseId,
        label: databaseId.replace(/^db:/, ""),
        dialect: erd.dialect,
        provenance,
        status: "detected",
        confidence: 0.85,
        evidenceIds: [evidenceId],
      });
    }

    if (!schemaKeys.has(schemaId)) {
      schemaKeys.add(schemaId);
      const evidenceId = `data:ev:schema:${schemaId}`;
      evidence.push({
        id: evidenceId,
        kind: "data-schema",
        status: "detected",
        origin: provenance === "live" ? "live" : "static",
        confidence: 0.85,
        summary: `Schema ${schemaName}`,
        attributes: { databaseId, schemaName, provenance },
      });
      schemas.push({
        id: schemaId,
        databaseId,
        name: schemaName,
        provenance,
        status: "detected",
        confidence: 0.85,
        evidenceIds: [evidenceId],
      });
    }

    const tableId = table.id || table.name || table.label || `table:${tables.length}`;
    const tableName = table.name || table.label || tableId;
    const tableEvidenceId = `data:ev:table:${tableId}`;
    evidence.push({
      id: tableEvidenceId,
      kind: "data-table",
      status: "detected",
      origin: provenance === "live" ? "live" : "static",
      confidence: 0.9,
      summary: `Table ${tableName}`,
      attributes: {
        schemaId,
        provenance,
        // Explicitly never persist samples
        hasSample: Boolean(table.sample),
      },
    });

    const columnIds: string[] = [];
    for (const column of table.columns ?? []) {
      const columnId = `${tableId}:col:${column.name}`;
      columnIds.push(columnId);
      const colEvidenceId = `data:ev:column:${columnId}`;
      evidence.push({
        id: colEvidenceId,
        kind: "data-column",
        status: "detected",
        origin: "static",
        confidence: 0.9,
        summary: `Column ${column.name}`,
        attributes: {
          tableId,
          dataType: column.type ?? null,
          nullable: column.nullable ?? null,
        },
      });
      columns.push({
        id: columnId,
        tableId,
        name: column.name,
        dataType: column.type,
        nullable: column.nullable,
        defaultValue: redactDefault(column.default),
        status: "detected",
        confidence: 0.9,
        evidenceIds: [colEvidenceId],
      });
    }

    tables.push({
      id: tableId,
      schemaId,
      name: tableName,
      label: table.label || tableName,
      provenance,
      status: "detected",
      confidence: 0.9,
      evidenceIds: [tableEvidenceId],
      columnIds,
      attributes: { databaseId },
    });

    if (table.rls != null) {
      const policyId = `${tableId}:policy:rls`;
      const policyEvidenceId = `data:ev:policy:${policyId}`;
      evidence.push({
        id: policyEvidenceId,
        kind: "data-policy",
        status: "detected",
        origin: "static",
        confidence: 0.7,
        summary: `RLS policy on ${tableName}`,
        attributes: { tableId, hasExpression: true },
      });
      policies.push({
        id: policyId,
        tableId,
        name: "rls",
        hasExpression: true,
        status: "detected",
        confidence: 0.7,
        evidenceIds: [policyEvidenceId],
        attributes: { redacted: true },
      });
    }
  }

  for (const edge of erd.edges ?? []) {
    const evidenceId = `data:ev:relation:${edge.id}`;
    evidence.push({
      id: evidenceId,
      kind: "data-relation",
      status: "detected",
      origin: "static",
      confidence: 0.85,
      summary: `FK ${edge.fromTable} → ${edge.toTable}`,
      attributes: {
        fromColumn: edge.fromColumn ?? null,
        toColumn: edge.toColumn ?? null,
      },
    });
    relations.push({
      id: edge.id,
      kind: "fk",
      fromTableId: edge.fromTable,
      toTableId: edge.toTable,
      fromColumn: edge.fromColumn,
      toColumn: edge.toColumn,
      status: "detected",
      confidence: 0.85,
      evidenceIds: [evidenceId],
    });
  }

  return {
    version: 1,
    projectId: erd.projectId,
    analyzedAt,
    databases,
    schemas,
    tables,
    columns,
    relations,
    policies,
    evidence,
    stats: {
      databaseCount: databases.length,
      schemaCount: schemas.length,
      tableCount: tables.length,
      columnCount: columns.length,
      relationCount: relations.length,
      policyCount: policies.length,
      conflictCount: 0,
    },
  };
}
