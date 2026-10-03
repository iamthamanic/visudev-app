/**
 * Why this file exists: keep `utils/api` + local client coupling in one adapter
 * so data services stay portable and testable without mocking the facade.
 * SDE-12: ERD responses pass through DataGraph resolve (no UI-side schema analyzer).
 */
import {
  parseDataAnalysisMode,
  resolveDataAnalysis,
  type LegacyErdSnapshot,
} from "../../../../shared/scan-detector/index.js";
import { getVisuDevClient, isLocalVisuDevMode } from "../../../lib/visudev-api";
import { api } from "../../../utils/api";
import type { ERDData } from "../types";
import type { DataApiPort, DataServiceResult } from "./data.port";

function readDataMode() {
  const fromVite =
    typeof import.meta !== "undefined" && import.meta.env
      ? (import.meta.env.VITE_VISUDEV_DATA_ANALYSIS_MODE as string | undefined)
      : undefined;
  const fromProcess =
    typeof process !== "undefined" ? process.env?.VISUDEV_DATA_ANALYSIS_MODE : undefined;
  return parseDataAnalysisMode(fromVite ?? fromProcess);
}

function toLegacyErd(projectId: string, data: ERDData): LegacyErdSnapshot {
  return {
    projectId,
    updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : undefined,
    nodes: data.nodes,
    tables: data.tables,
    edges: Array.isArray((data as { edges?: unknown }).edges)
      ? ((data as { edges: LegacyErdSnapshot["edges"] }).edges ?? [])
      : undefined,
    dialect:
      typeof (data as { dialect?: unknown }).dialect === "string"
        ? (data as { dialect: string }).dialect
        : undefined,
    source:
      typeof (data as { source?: unknown }).source === "string"
        ? (data as { source: string }).source
        : undefined,
    message: typeof data.message === "string" ? data.message : undefined,
  };
}

function applyDataGraphResolve(projectId: string, data: ERDData): ERDData {
  const resolved = resolveDataAnalysis({
    mode: readDataMode(),
    legacyErd: toLegacyErd(projectId, data),
  });
  return {
    ...data,
    projectId,
    updatedAt: resolved.erd.updatedAt ?? data.updatedAt,
    nodes: resolved.erd.nodes as ERDData["nodes"],
    tables: resolved.erd.tables as ERDData["tables"],
    message: resolved.erd.message ?? data.message,
    analysisMode: resolved.mode,
    analysisSource: resolved.source,
    analysisParityPassed: resolved.parity?.passed ?? null,
  } as ERDData;
}

async function getERDViaRuntime(projectId: string): Promise<DataServiceResult<ERDData>> {
  if (isLocalVisuDevMode()) {
    try {
      const latest = await getVisuDevClient().getDataLatest(projectId);
      if (latest) {
        const base: ERDData = {
          projectId,
          updatedAt: latest.updatedAt,
          nodes: latest.nodes as ERDData["nodes"],
          tables: latest.tables as ERDData["tables"],
          message: latest.message,
          edges: (latest as { edges?: unknown }).edges,
          dialect: (latest as { dialect?: unknown }).dialect,
          source: (latest as { source?: unknown }).source,
        } as ERDData;
        return {
          success: true,
          data: applyDataGraphResolve(projectId, base),
        };
      }
      return {
        success: true,
        data: {
          projectId,
          nodes: [],
          tables: [],
          message:
            "Noch keine Tabellen. Schema analysieren oder DATABASE_URL in der Projekt-.env setzen.",
        },
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Failed to fetch ERD",
      };
    }
  }
  const result = await api.data.getERD(projectId);
  if (!result.success || !result.data) return result;
  return { success: true, data: applyDataGraphResolve(projectId, result.data) };
}

export const dataApiAdapter: DataApiPort = {
  getSchema: (projectId) => api.data.getSchema(projectId),
  updateSchema: (projectId, data) => api.data.updateSchema(projectId, data),
  getMigrations: (projectId) => api.data.getMigrations(projectId),
  updateMigrations: (projectId, data) => api.data.updateMigrations(projectId, data),
  getERD: getERDViaRuntime,
  updateERD: (projectId, data) => api.data.updateERD(projectId, data),
};
