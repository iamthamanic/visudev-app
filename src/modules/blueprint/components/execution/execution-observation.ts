/**
 * ObservationClass for Execution steps — static model vs runtime trust (PR-09).
 * Location: src/modules/blueprint/components/execution/execution-observation.ts
 */

import type { SoftwareGraph, SoftwareGraphEvidence, SoftwareGraphNode } from "../../types";

export const EXECUTION_OBSERVATION_CLASSES = [
  "STATIC_MODEL",
  "RUNTIME_VERIFIED",
  "OBSERVED_TRACE",
  "CONFLICTED",
] as const;

export type ExecutionObservationClass = (typeof EXECUTION_OBSERVATION_CLASSES)[number];

export const EXECUTION_OBSERVATION_LABELS: Record<ExecutionObservationClass, string> = {
  STATIC_MODEL: "Statisches Modell",
  RUNTIME_VERIFIED: "Runtime verifiziert",
  OBSERVED_TRACE: "Beobachteter Trace",
  CONFLICTED: "Konflikt",
};

function truthyMeta(value: unknown): boolean {
  return value === true || value === "true" || value === 1;
}

function hasRuntimeEvidence(
  evidence: readonly SoftwareGraphEvidence[],
  node: SoftwareGraphNode,
): boolean {
  return evidence.some((item) => {
    if (item.nodeId !== node.id && item.filePath !== node.filePath) return false;
    const kind = item.kind.toLowerCase();
    return (
      kind.includes("runtime") ||
      kind.includes("trace") ||
      kind.includes("observe") ||
      kind.includes("telemetry")
    );
  });
}

function isConflictedNode(node: SoftwareGraphNode): boolean {
  if (truthyMeta(node.metadata?.runtimeConflict)) return true;
  const knowledge = node.metadata?.knowledgeStatus;
  if (typeof knowledge === "string" && knowledge.toUpperCase() === "CONFLICTED") return true;
  const status = node.metadata?.status;
  if (typeof status === "string" && status.toLowerCase() === "conflicted") return true;
  return false;
}

/**
 * Resolve trust layer for one execution step. Dominance: CONFLICTED >
 * OBSERVED_TRACE > RUNTIME_VERIFIED > STATIC_MODEL.
 */
export function resolveExecutionObservationClass(
  node: SoftwareGraphNode | undefined,
  graph?: SoftwareGraph | null,
): ExecutionObservationClass {
  if (!node) return "STATIC_MODEL";
  if (isConflictedNode(node)) return "CONFLICTED";

  const evidence = graph && Array.isArray(graph.evidence) ? graph.evidence : [];
  if (truthyMeta(node.metadata?.runtimeObserved) || hasRuntimeEvidence(evidence, node)) {
    return "OBSERVED_TRACE";
  }
  if (truthyMeta(node.metadata?.runtimeVerified)) {
    return "RUNTIME_VERIFIED";
  }
  return "STATIC_MODEL";
}

export function observationLabel(observation: ExecutionObservationClass): string {
  return EXECUTION_OBSERVATION_LABELS[observation];
}
