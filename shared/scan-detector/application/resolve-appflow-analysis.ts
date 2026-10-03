/**
 * Resolve AppFlow screens/edges via analysis mode (SDE-11).
 * Engine path uses UIInteractionGraph projection only — no new AST inference.
 * Location: shared/scan-detector/application/resolve-appflow-analysis.ts
 */

import type { RuntimeObserverCrawlResult } from "../domain/runtime/crawl-result.js";
import type { AppflowAnalysisMode } from "../domain/appflow-analysis-mode.js";
import type { LegacyScreenLike, UiKnowledgeStatus } from "../../ui-interaction-graph.types.js";
import { adaptLegacyScreensToUiGraph } from "./adapt-legacy-screens-to-ui-graph.js";
import { fuseRuntimeIntoUiGraph } from "./fuse-runtime-into-ui-graph.js";
import {
  projectUiGraphToAppflow,
  type AppflowProjectionEdge,
  type AppflowProjectionModel,
} from "./project-ui-graph-to-appflow.js";

export type AppflowAnalysisSource = "legacy" | "engine-projection" | "legacy-fallback";

export interface AppflowLegacyFlowLike {
  id: string;
  name: string;
  calls?: string[];
}

export interface ResolveAppflowAnalysisInput {
  mode: AppflowAnalysisMode;
  projectId: string;
  legacyScreens: readonly LegacyScreenLike[];
  /** Optional runtime crawl for verify/conflict/runtime-only (SDE-09/10). */
  runtimeCrawl?: RuntimeObserverCrawlResult;
  /** Legacy call edges only used when mode is legacy/shadow render path. */
  legacyCallEdges?: ReadonlyArray<{ fromId: string; toId: string }>;
}

export interface AppflowParityResult {
  screenCountMatch: boolean;
  transitionCoverage: number;
  missingTransitionKeys: string[];
  extraTransitionKeys: string[];
  passed: boolean;
}

export interface ResolveAppflowAnalysisResult {
  mode: AppflowAnalysisMode;
  screens: LegacyScreenLike[];
  edges: AppflowProjectionEdge[];
  surfaceStatusByScreenId: Record<string, UiKnowledgeStatus>;
  surfaceConfidenceByScreenId: Record<string, number>;
  engineModel: AppflowProjectionModel | null;
  parity: AppflowParityResult | null;
  source: AppflowAnalysisSource;
  fallbackUsed: boolean;
  fallbackReason?: string;
}

function edgeKey(edge: {
  fromId: string;
  toId: string;
  type: string;
  trigger?: { label?: string };
}): string {
  return `${edge.fromId}\t${edge.toId}\t${edge.type}\t${edge.trigger?.label ?? ""}`;
}

function legacyNavigateAndStateEdges(
  screens: readonly LegacyScreenLike[],
): AppflowProjectionEdge[] {
  const edges: AppflowProjectionEdge[] = [];
  const seen = new Set<string>();
  const byId = new Map(screens.map((screen) => [screen.id, screen]));

  for (const source of screens) {
    for (const targetPath of source.navigatesTo ?? []) {
      const normalized = targetPath.trim().startsWith("/")
        ? targetPath.trim()
        : `/${targetPath.trim()}`;
      const target =
        screens.find((screen) => (screen.path || "").trim() === normalized) ??
        screens.find((screen) => screen.id === targetPath);
      if (!target || target.id === source.id) continue;
      const candidate: AppflowProjectionEdge = {
        fromId: source.id,
        toId: target.id,
        type: "navigate",
        targetPath: normalized,
        status: "inferred",
        confidence: 0.6,
      };
      const key = edgeKey(candidate);
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push(candidate);
    }
    for (const st of source.stateTargets ?? []) {
      const target = byId.get(st.targetScreenId);
      if (!target || target.id === source.id) continue;
      const type =
        st.edgeType === "switch-tab"
          ? "switch-tab"
          : st.edgeType === "dropdown-action"
            ? "dropdown-action"
            : "open-modal";
      const candidate: AppflowProjectionEdge = {
        fromId: source.id,
        toId: target.id,
        type,
        trigger: st.trigger,
        status: "inferred",
        confidence: st.trigger?.confidence ?? 0.65,
      };
      const key = edgeKey(candidate);
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push(candidate);
    }
  }
  return edges;
}

function compareParity(
  legacyEdges: readonly AppflowProjectionEdge[],
  engineEdges: readonly AppflowProjectionEdge[],
  legacyScreenCount: number,
  engineScreenCount: number,
): AppflowParityResult {
  const legacyKeys = new Set(legacyEdges.map(edgeKey));
  const engineKeys = new Set(engineEdges.map(edgeKey));
  const missingTransitionKeys = [...legacyKeys].filter((key) => !engineKeys.has(key));
  const extraTransitionKeys = [...engineKeys].filter((key) => !legacyKeys.has(key));
  const covered =
    legacyKeys.size === 0 ? 1 : (legacyKeys.size - missingTransitionKeys.length) / legacyKeys.size;
  const screenCountMatch = legacyScreenCount === engineScreenCount;
  const passed = screenCountMatch && missingTransitionKeys.length === 0;
  return {
    screenCountMatch,
    transitionCoverage: covered,
    missingTransitionKeys,
    extraTransitionKeys,
    passed,
  };
}

function buildEngineModel(input: ResolveAppflowAnalysisInput): AppflowProjectionModel {
  let graph = adaptLegacyScreensToUiGraph({
    projectId: input.projectId,
    screens: input.legacyScreens,
    detectorId: "web-ui-legacy-adapter-v1",
  });
  if (input.runtimeCrawl) {
    graph = fuseRuntimeIntoUiGraph({
      graph,
      crawl: input.runtimeCrawl,
      detectorId: "web-ui-interaction-graph-v1",
    });
  }
  return projectUiGraphToAppflow(graph);
}

/**
 * Resolve AppFlow render model. Engine never invents AST edges — only UI graph projection.
 */
export function resolveAppflowAnalysis(
  input: ResolveAppflowAnalysisInput,
): ResolveAppflowAnalysisResult {
  const legacyEdges = [
    ...legacyNavigateAndStateEdges(input.legacyScreens),
    ...(input.legacyCallEdges ?? []).map(
      (edge): AppflowProjectionEdge => ({
        fromId: edge.fromId,
        toId: edge.toId,
        type: "navigate",
        status: "inferred",
        confidence: 0.5,
      }),
    ),
  ];

  if (input.mode === "legacy") {
    const statuses: Record<string, UiKnowledgeStatus> = {};
    const confidences: Record<string, number> = {};
    for (const screen of input.legacyScreens) {
      statuses[screen.id] = "inferred";
      confidences[screen.id] = 0.6;
    }
    return {
      mode: "legacy",
      screens: [...input.legacyScreens],
      edges: legacyEdges,
      surfaceStatusByScreenId: statuses,
      surfaceConfidenceByScreenId: confidences,
      engineModel: null,
      parity: null,
      source: "legacy",
      fallbackUsed: false,
    };
  }

  let engineModel: AppflowProjectionModel;
  try {
    engineModel = buildEngineModel(input);
  } catch (error) {
    const statuses: Record<string, UiKnowledgeStatus> = {};
    for (const screen of input.legacyScreens) statuses[screen.id] = "inferred";
    return {
      mode: input.mode,
      screens: [...input.legacyScreens],
      edges: legacyEdges,
      surfaceStatusByScreenId: statuses,
      surfaceConfidenceByScreenId: {},
      engineModel: null,
      parity: null,
      source: "legacy-fallback",
      fallbackUsed: true,
      fallbackReason: error instanceof Error ? error.message : "engine projection failed",
    };
  }

  const parity = compareParity(
    legacyEdges,
    engineModel.edges,
    input.legacyScreens.length,
    engineModel.screens.length,
  );

  if (input.mode === "shadow") {
    return {
      mode: "shadow",
      screens: [...input.legacyScreens],
      edges: legacyEdges,
      surfaceStatusByScreenId: engineModel.surfaceStatusByScreenId,
      surfaceConfidenceByScreenId: engineModel.surfaceConfidenceByScreenId,
      engineModel,
      parity,
      source: "legacy",
      fallbackUsed: false,
    };
  }

  // engine mode — render from projection; keep legacy fallback only if empty projection
  if (engineModel.screens.length === 0 && input.legacyScreens.length > 0) {
    return {
      mode: "engine",
      screens: [...input.legacyScreens],
      edges: legacyEdges,
      surfaceStatusByScreenId: engineModel.surfaceStatusByScreenId,
      surfaceConfidenceByScreenId: engineModel.surfaceConfidenceByScreenId,
      engineModel,
      parity,
      source: "legacy-fallback",
      fallbackUsed: true,
      fallbackReason: "empty engine projection",
    };
  }

  return {
    mode: "engine",
    screens: engineModel.screens,
    edges: engineModel.edges,
    surfaceStatusByScreenId: engineModel.surfaceStatusByScreenId,
    surfaceConfidenceByScreenId: engineModel.surfaceConfidenceByScreenId,
    engineModel,
    parity,
    source: "engine-projection",
    fallbackUsed: false,
  };
}
