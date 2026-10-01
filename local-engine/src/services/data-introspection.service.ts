/**
 * Schema introspection for local Data scans (PostgreSQL + SQLite).
 * Location: local-engine/src/services/data-introspection.service.ts
 */

import path from "node:path";
import {
  resolveDatabaseConfig,
  type ResolvedDatabaseConfig,
} from "../lib/resolve-database-config.js";

export type ErdColumn = {
  name: string;
  type?: string;
  nullable?: boolean;
  default?: string;
};

export type ErdFkEdge = {
  id: string;
  fromTable: string;
  toTable: string;
  fromColumn: string;
  toColumn: string;
};

export type ErdTableNode = {
  id: string;
  name?: string;
  label?: string;
  columns?: ErdColumn[];
};

export type DataIntrospectionResult = {
  nodes: ErdTableNode[];
  tables: ErdTableNode[];
  edges?: ErdFkEdge[];
  message?: string;
  source?: string;
  dialect?: "postgres" | "sqlite";
};

type PostgresRow = {
  table_name: string;
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
};

function buildNodesFromRows(
  rows: Array<{
    tableName: string;
    columnName: string;
    dataType?: string;
    isNullable?: boolean;
    columnDefault?: string | null;
  }>,
): ErdTableNode[] {
  const byTable = new Map<string, ErdColumn[]>();
  for (const row of rows) {
    const columns = byTable.get(row.tableName) ?? [];
    columns.push({
      name: row.columnName,
      type: row.dataType,
      nullable: row.isNullable,
      default: row.columnDefault ?? undefined,
    });
    byTable.set(row.tableName, columns);
  }

  return [...byTable.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([tableName, columns]) => ({
      id: tableName,
      name: tableName,
      label: tableName,
      columns,
    }));
}

async function introspectPostgres(connectionString: string): Promise<DataIntrospectionResult> {
  const pg = await import("pg");
  const client = new pg.Client({ connectionString });
  try {
    await client.connect();
    const result = await client.query<PostgresRow>(
      `SELECT table_name, column_name, data_type, is_nullable, column_default
       FROM information_schema.columns
       WHERE table_schema = 'public'
       ORDER BY table_name, ordinal_position`,
    );
    const nodes = buildNodesFromRows(
      result.rows.map((row) => ({
        tableName: row.table_name,
        columnName: row.column_name,
        dataType: row.data_type,
        isNullable: row.is_nullable === "YES",
        columnDefault: row.column_default,
      })),
    );
    const fkResult = await client.query<{
      constraint_name: string;
      table_name: string;
      column_name: string;
      foreign_table_name: string;
      foreign_column_name: string;
    }>(
      `SELECT
         tc.constraint_name,
         tc.table_name,
         kcu.column_name,
         ccu.table_name AS foreign_table_name,
         ccu.column_name AS foreign_column_name
       FROM information_schema.table_constraints AS tc
       JOIN information_schema.key_column_usage AS kcu
         ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
       JOIN information_schema.constraint_column_usage AS ccu
         ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
       WHERE tc.constraint_type = 'FOREIGN KEY'
         AND tc.table_schema = 'public'
       ORDER BY tc.table_name, kcu.ordinal_position`,
    );
    const edges: ErdFkEdge[] = fkResult.rows.map((row) => ({
      id: `fk:${row.table_name}.${row.column_name}->${row.foreign_table_name}.${row.foreign_column_name}`,
      fromTable: row.table_name,
      toTable: row.foreign_table_name,
      fromColumn: row.column_name,
      toColumn: row.foreign_column_name,
    }));
    return { nodes, tables: nodes, edges, dialect: "postgres" };
  } finally {
    await client.end().catch(() => undefined);
  }
}

async function introspectSqlite(filePath: string): Promise<DataIntrospectionResult> {
  const sqlite = await import("node:sqlite");
  const db = new sqlite.DatabaseSync(filePath, { readOnly: true });
  try {
    const tables = db
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
         ORDER BY name`,
      )
      .all() as Array<{ name: string }>;

    const rows: Array<{
      tableName: string;
      columnName: string;
      dataType?: string;
      isNullable?: boolean;
      columnDefault?: string | null;
    }> = [];

    for (const table of tables) {
      const columns = db
        .prepare(`PRAGMA table_info(${JSON.stringify(table.name)})`)
        .all() as Array<{
        name: string;
        type?: string;
        notnull?: number;
        dflt_value?: string | null;
      }>;
      for (const column of columns) {
        rows.push({
          tableName: table.name,
          columnName: column.name,
          dataType: column.type || undefined,
          isNullable: column.notnull !== 1,
          columnDefault: column.dflt_value,
        });
      }
    }

    const nodes = buildNodesFromRows(rows);
    const edges: ErdFkEdge[] = [];
    for (const table of tables) {
      const fks = db
        .prepare(`PRAGMA foreign_key_list(${JSON.stringify(table.name)})`)
        .all() as Array<{ id: number; table: string; from: string; to: string }>;
      for (const fk of fks) {
        edges.push({
          id: `fk:${table.name}.${fk.from}->${fk.table}.${fk.to}`,
          fromTable: table.name,
          toTable: fk.table,
          fromColumn: fk.from,
          toColumn: fk.to,
        });
      }
    }
    return { nodes, tables: nodes, edges, dialect: "sqlite" };
  } finally {
    db.close();
  }
}

export async function introspectDatabaseFromProjectRoot(
  projectRoot: string,
): Promise<DataIntrospectionResult> {
  const config = resolveDatabaseConfig(projectRoot);
  return introspectWithConfig(config, projectRoot);
}

export async function introspectWithConfig(
  config: ResolvedDatabaseConfig,
  projectRoot: string,
): Promise<DataIntrospectionResult> {
  if (config.kind === "none") {
    return {
      nodes: [],
      tables: [],
      message: config.message,
    };
  }

  try {
    if (config.kind === "postgres") {
      const result = await introspectPostgres(config.connectionString);
      return { ...result, source: config.source };
    }

    const sqlitePath = path.isAbsolute(config.filePath)
      ? config.filePath
      : path.resolve(projectRoot, config.filePath);
    const result = await introspectSqlite(sqlitePath);
    return { ...result, source: config.source };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Schema introspection failed: ${message}`);
  }
}
