/**
 * Resolve Data ERD via analysis mode (SDE-12).
 * Engine path uses DataGraph projection only — no UI-side schema analyzer.
 * Location: shared/scan-detector/application/resolve-data-analysis.ts
 */

import type { DataGraph, LegacyErdSnapshot } from "../../data-graph.types.js";
import type { DataAnalysisMode } from "../domain/data-analysis-mode.js";
import { adaptErdToDataGraph } from "./adapt-erd-to-data-graph.js";
import { projectDataGraphToErd } from "./project-data-graph-to-erd.js";

export type DataAnalysisSource = "engine-projection" | "legacy-fallback";

export interface DataParityResult {
  tableCountMatch: boolean;
  columnCoverage: number;
  missingTableIds: string[];
  passed: boolean;
}

export interface ResolveDataAnalysisInput {
  /** Always treated as engine (SDE-15); retained for call-site BC. */
  mode?: DataAnalysisMode;
  legacyErd: LegacyErdSnapshot;
}

export interface ResolveDataAnalysisResult {
  mode: DataAnalysisMode;
  erd: LegacyErdSnapshot;
  dataGraph: DataGraph | null;
  parity: DataParityResult | null;
  source: DataAnalysisSource;
  fallbackUsed: boolean;
  fallbackReason?: string;
}

function tableIds(erd: LegacyErdSnapshot): string[] {
  const tables = Array.isArray(erd.tables) ? erd.tables : Array.isArray(erd.nodes) ? erd.nodes : [];
  return tables.map((table) => table.id).filter(Boolean);
}

function columnCount(erd: LegacyErdSnapshot): number {
  const tables = Array.isArray(erd.tables) ? erd.tables : Array.isArray(erd.nodes) ? erd.nodes : [];
  return tables.reduce((sum, table) => sum + (table.columns?.length ?? 0), 0);
}

function compareParity(legacy: LegacyErdSnapshot, engine: LegacyErdSnapshot): DataParityResult {
  const legacyIds = new Set(tableIds(legacy));
  const engineIds = new Set(tableIds(engine));
  const missingTableIds = [...legacyIds].filter((id) => !engineIds.has(id));
  const legacyColumns = columnCount(legacy);
  const engineColumns = columnCount(engine);
  const columnCoverage =
    legacyColumns === 0 ? 1 : Math.min(1, engineColumns / Math.max(legacyColumns, 1));
  const tableCountMatch = legacyIds.size === engineIds.size && missingTableIds.length === 0;
  return {
    tableCountMatch,
    columnCoverage,
    missingTableIds,
    passed: tableCountMatch && missingTableIds.length === 0,
  };
}

export function resolveDataAnalysis(input: ResolveDataAnalysisInput): ResolveDataAnalysisResult {
  const mode: DataAnalysisMode = "engine";
  void input.mode;

  let dataGraph: DataGraph;
  try {
    dataGraph = adaptErdToDataGraph({ erd: input.legacyErd });
  } catch (error) {
    return {
      mode,
      erd: input.legacyErd,
      dataGraph: null,
      parity: null,
      source: "legacy-fallback",
      fallbackUsed: true,
      fallbackReason: error instanceof Error ? error.message : "data graph adapt failed",
    };
  }

  const engineErd = projectDataGraphToErd(dataGraph);
  const parity = compareParity(input.legacyErd, engineErd);

  if (engineErd.tables?.length === 0 && tableIds(input.legacyErd).length > 0) {
    return {
      mode,
      erd: input.legacyErd,
      dataGraph,
      parity,
      source: "legacy-fallback",
      fallbackUsed: true,
      fallbackReason: "empty engine projection",
    };
  }

  return {
    mode,
    erd: {
      ...engineErd,
      message: input.legacyErd.message,
    },
    dataGraph,
    parity,
    source: "engine-projection",
    fallbackUsed: false,
  };
}
