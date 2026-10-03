/**
 * AppFlow resolve wrapper — maps VisuDEV runtime crawl into engine resolve (SDE-11).
 * Location: src/modules/appflow/services/resolve-appflow-view.ts
 */

import {
  parseAppflowAnalysisMode,
  resolveAppflowAnalysis,
  type AppflowProjectionEdge,
  type ResolveAppflowAnalysisResult,
} from "../../../lib/visudev-api/appflow-analysis";
import type { RuntimeCrawlResult } from "../../../lib/visudev/runtime-crawl";
import type { Flow, Screen } from "../../../lib/visudev/types";
import type { GraphEdge, GraphEdgeType } from "../layout";

function readAppflowMode(): ReturnType<typeof parseAppflowAnalysisMode> {
  const fromVite =
    typeof import.meta !== "undefined" && import.meta.env
      ? (import.meta.env.VITE_VISUDEV_APPFLOW_ANALYSIS_MODE as string | undefined)
      : undefined;
  const fromProcess =
    typeof process !== "undefined" ? process.env?.VISUDEV_APPFLOW_ANALYSIS_MODE : undefined;
  return parseAppflowAnalysisMode(fromVite ?? fromProcess);
}

function toRuntimeObserverCrawl(runtime: RuntimeCrawlResult | undefined) {
  if (!runtime) return undefined;
  return {
    baseUrl: runtime.baseUrl,
    crawledAt: runtime.crawledAt,
    summary: runtime.summary,
    snapshots: runtime.snapshots,
    verifiedEdges: runtime.verifiedEdges,
    stateScreens: runtime.stateScreens,
    issues: runtime.issues,
  };
}

function mapProjectionEdgeType(type: AppflowProjectionEdge["type"]): GraphEdgeType {
  if (type === "menu-action") return "dropdown-action";
  if (type === "close-surface") return "close-surface";
  return type;
}

export function projectionEdgesToGraphEdges(edges: readonly AppflowProjectionEdge[]): GraphEdge[] {
  return edges.map((edge) => ({
    fromId: edge.fromId,
    toId: edge.toId,
    type: mapProjectionEdgeType(edge.type),
    targetPath: edge.targetPath,
    trigger: edge.trigger,
  }));
}

export interface ResolveAppflowViewInput {
  projectId: string;
  screens: Screen[];
  flows: Flow[];
  analysisRuntime?: RuntimeCrawlResult;
  /** Optional override for tests. */
  mode?: ReturnType<typeof parseAppflowAnalysisMode>;
}

export interface ResolveAppflowViewResult extends ResolveAppflowAnalysisResult {
  graphEdges: GraphEdge[];
  displayScreens: Screen[];
}

/**
 * Resolve AppFlow canvas inputs. No AST inference — engine path is UI graph only.
 */
export function resolveAppflowView(input: ResolveAppflowViewInput): ResolveAppflowViewResult {
  const mode = input.mode ?? readAppflowMode();
  const resolved = resolveAppflowAnalysis({
    mode,
    projectId: input.projectId || "appflow",
    legacyScreens: input.screens,
    runtimeCrawl: toRuntimeObserverCrawl(input.analysisRuntime),
  });

  return {
    ...resolved,
    graphEdges: projectionEdgesToGraphEdges(resolved.edges),
    displayScreens: resolved.screens as Screen[],
  };
}
