/**
 * VisuDEV API client factory and singleton accessor.
 * Location: src/lib/visudev-api/index.ts
 */

import type { VisuDevApiClient } from "./client";
import { LocalVisuDevClient } from "./local-client";
import { SupabaseVisuDevClient } from "./supabase-client";
import type { VisuDevMode } from "./types";

export type { VisuDevApiClient } from "./client";
export { VisuDevApiError } from "./errors";
export * from "./types";
/** SDE-07 Projection/Query surface for Blueprint / AppFlow / Data consumers. */
export {
  PROJECTION_DEFAULT_LIMIT,
  PROJECTION_HARD_MAX_LIMIT,
  projectAppFlowReadModel,
  projectBlueprintReadModel,
  projectDataReadModel,
} from "./scan-projection";
export type {
  AppFlowProjectionReadModel,
  BlueprintProjectionReadModel,
  DataProjectionReadModel,
  ProjectReadModelInput,
  ProjectionEntity,
  ProjectionEvidenceLink,
  ProjectionPageMeta,
  ProjectionQueryOptions,
  ProjectionQueryScope,
  ProjectionReadModel,
  ProjectionRelation,
  ProjectionSlice,
} from "./scan-projection";

/** SDE-15 Blueprint / AppFlow / Data analysis facades (engine authority). */
export {
  DEFAULT_BLUEPRINT_ANALYSIS_MODE,
  parseBlueprintAnalysisMode,
  resolveBlueprintAnalysis,
} from "../../../shared/scan-detector/index.js";
export type {
  BlueprintAnalysisMode,
  BlueprintAnalysisSource,
  ResolveBlueprintAnalysisResult,
} from "../../../shared/scan-detector/index.js";
export {
  DEFAULT_APPFLOW_ANALYSIS_MODE,
  parseAppflowAnalysisMode,
  resolveAppflowAnalysis,
} from "./appflow-analysis";
export type {
  AppflowAnalysisMode,
  AppflowAnalysisSource,
  AppflowProjectionEdge,
  ResolveAppflowAnalysisResult,
  UiKnowledgeStatus,
} from "./appflow-analysis";
export {
  DEFAULT_DATA_ANALYSIS_MODE,
  parseDataAnalysisMode,
  resolveDataAnalysis,
} from "./data-analysis";
export type {
  DataAnalysisMode,
  DataAnalysisSource,
  LegacyErdSnapshot,
  ResolveDataAnalysisResult,
} from "./data-analysis";
export {
  adaptLegacyScreensToUiGraph,
  buildDataLineage,
  softwareGraphToScanFacts,
} from "./data-lineage";
export type {
  BuildDataLineageInput,
  DataLineageGraph,
  DataLineageLayer,
  DataLineagePath,
  LineageEntityRef,
  LineageHop,
  LineageHopEvidence,
  LineagePathStatus,
} from "./data-lineage";

let client: VisuDevApiClient | null = null;
let supabaseClient: SupabaseVisuDevClient | null = null;

export function resolveVisuDevMode(mode?: VisuDevMode): VisuDevMode {
  const fromEnv =
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_VISUDEV_MODE) || "local";
  const resolved = (mode ?? fromEnv) as VisuDevMode;
  if (resolved === "hybrid") {
    throw new Error("Hybrid mode is reserved but not implemented in the Local-First phase.");
  }
  if (resolved !== "local" && resolved !== "supabase") {
    throw new Error(`Unsupported VisuDEV mode: ${resolved}`);
  }
  return resolved;
}

export function createVisuDevClient(mode?: VisuDevMode): VisuDevApiClient {
  const resolvedMode = resolveVisuDevMode(mode);
  if (resolvedMode === "local") {
    return new LocalVisuDevClient();
  }
  if (!supabaseClient) {
    supabaseClient = new SupabaseVisuDevClient();
  }
  return supabaseClient;
}

export function getVisuDevClient(): VisuDevApiClient {
  if (!client) {
    client = createVisuDevClient();
  }
  return client;
}

export function setSupabaseAccessToken(token: string | null): void {
  if (!supabaseClient) {
    supabaseClient = new SupabaseVisuDevClient();
  }
  supabaseClient.setAccessToken(token);
}

export function isLocalVisuDevMode(): boolean {
  return resolveVisuDevMode() === "local";
}
