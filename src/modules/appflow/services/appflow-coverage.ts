/**
 * AppFlow exploration coverage read model — COMPLETE only on frontier-exhausted (PR-13).
 * Location: src/modules/appflow/services/appflow-coverage.ts
 */

import type { AnalysisGraph } from "../../../lib/visudev/analysis-graph";
import type { RuntimeCrawlResult } from "../../../lib/visudev/runtime-crawl";

export type AppFlowExplorationStatus = "COMPLETE" | "PARTIAL" | "UNKNOWN";

export type AppFlowTerminationReason =
  | "frontier-exhausted"
  | "budget"
  | "timeout"
  | "auth-barrier"
  | "safety-barrier"
  | string;

export type ScreenVerificationKind = "static-only" | "runtime-verified" | "conflicted";

export interface AppFlowCoverageReport {
  status: AppFlowExplorationStatus;
  terminationReason: AppFlowTerminationReason | null;
  frontierSeedCount: number;
  visitedScreens: number;
  verifiedEdges: number;
  stateCaptures: number;
  blockedMutations: number;
  mismatchCount: number;
  barrierLabelDe: string;
  screenVerification: {
    staticOnly: number;
    runtimeVerified: number;
    conflicted: number;
  };
}

const PARTIAL_REASONS = new Set(["budget", "timeout", "auth-barrier", "safety-barrier"]);

function readTerminationReason(runtime: RuntimeCrawlResult | undefined): string | null {
  if (!runtime) return null;
  return runtime.terminationReason || runtime.summary.terminationReason || null;
}

export function classifyScreenVerification(
  graph: AnalysisGraph | undefined,
  screenId: string,
): ScreenVerificationKind {
  if (!graph) return "static-only";
  const node = graph.nodes.find((item) => item.sourceScreenId === screenId);
  if (!node) return "static-only";
  if (node.status === "conflicted") return "conflicted";
  if (
    node.status === "verified" ||
    node.status === "confirmed" ||
    node.origin === "runtime-verified"
  ) {
    return "runtime-verified";
  }
  const hasConflictIssue = graph.issues.some(
    (issue) =>
      issue.severity === "high" &&
      (issue.subjectId === node.id || issue.relatedIds?.includes(screenId)),
  );
  if (hasConflictIssue) return "conflicted";
  return "static-only";
}

export function buildAppFlowCoverageReport(
  graph: AnalysisGraph | undefined,
  runtime: RuntimeCrawlResult | undefined,
): AppFlowCoverageReport {
  const terminationReason = readTerminationReason(runtime);
  const summary = runtime?.summary;

  let status: AppFlowExplorationStatus = "UNKNOWN";
  if (terminationReason === "frontier-exhausted") status = "COMPLETE";
  else if (terminationReason && PARTIAL_REASONS.has(terminationReason)) status = "PARTIAL";
  else if (runtime) status = "PARTIAL";

  const screenVerification = { staticOnly: 0, runtimeVerified: 0, conflicted: 0 };
  for (const node of graph?.nodes ?? []) {
    const kind = classifyScreenVerification(graph, node.sourceScreenId);
    if (kind === "conflicted") screenVerification.conflicted += 1;
    else if (kind === "runtime-verified") screenVerification.runtimeVerified += 1;
    else screenVerification.staticOnly += 1;
  }

  const barrierLabelDe =
    terminationReason === "frontier-exhausted"
      ? "Frontier vollständig"
      : terminationReason === "budget"
        ? "Budget erreicht"
        : terminationReason === "timeout"
          ? "Timeout"
          : terminationReason === "auth-barrier"
            ? "Auth-Barriere"
            : terminationReason === "safety-barrier"
              ? "Safety-Barriere"
              : runtime
                ? "Teilweise Exploration"
                : "Keine Runtime-Exploration";

  return {
    status,
    terminationReason,
    frontierSeedCount: summary?.frontierSeedCount ?? 0,
    visitedScreens: summary?.visitedScreens ?? 0,
    verifiedEdges: summary?.verifiedEdges ?? 0,
    stateCaptures: summary?.stateCaptures ?? 0,
    blockedMutations: summary?.blockedMutations ?? 0,
    mismatchCount: summary?.mismatchCount ?? 0,
    barrierLabelDe,
    screenVerification,
  };
}
