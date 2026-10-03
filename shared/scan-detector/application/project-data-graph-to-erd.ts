/**
 * Project DataGraph → legacy ERD for DataPage compatibility (SDE-12).
 * Never includes sample rows; RLS becomes opaque marker only.
 * Location: shared/scan-detector/application/project-data-graph-to-erd.ts
 */

import type { DataGraph, LegacyErdSnapshot, LegacyErdTable } from "../../data-graph.types.js";

export function projectDataGraphToErd(graph: DataGraph): LegacyErdSnapshot {
  const columnsByTable = new Map<string, DataGraph["columns"]>();
  for (const column of graph.columns) {
    const list = columnsByTable.get(column.tableId) ?? [];
    list.push(column);
    columnsByTable.set(column.tableId, list);
  }

  const schemaById = new Map(graph.schemas.map((schema) => [schema.id, schema]));
  const tables: LegacyErdTable[] = graph.tables.map((table) => {
    const schema = schemaById.get(table.schemaId);
    const hasPolicy = graph.policies.some((policy) => policy.tableId === table.id);
    return {
      id: table.id,
      name: table.name,
      label: table.label,
      schema: schema?.name,
      databaseId:
        schema?.databaseId ??
        (typeof table.attributes?.databaseId === "string"
          ? table.attributes.databaseId
          : undefined),
      columns: (columnsByTable.get(table.id) ?? []).map((column) => ({
        name: column.name,
        type: column.dataType,
        nullable: column.nullable,
        default: column.defaultValue,
      })),
      // Opaque marker only — never rehydrate policy expression text
      rls: hasPolicy ? { enabled: true, redacted: true } : undefined,
    };
  });

  return {
    projectId: graph.projectId,
    updatedAt: graph.analyzedAt,
    nodes: tables,
    tables,
    edges: graph.relations.map((relation) => ({
      id: relation.id,
      fromTable: relation.fromTableId,
      toTable: relation.toTableId,
      fromColumn: relation.fromColumn,
      toColumn: relation.toColumn,
    })),
    dialect: graph.databases[0]?.dialect,
    source: `datagraph:${graph.databases[0]?.provenance ?? "unknown"}`,
  };
}
