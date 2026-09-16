/**
 * Sequence projection from execution groups — prefers observed edges when present.
 * Location: src/modules/blueprint/components/execution/execution-sequence-projection.ts
 */

import type { SoftwareGraph, SoftwareGraphNode } from "../../types";

export interface SequenceStep {
  id: string;
  label: string;
  observed: boolean;
}

export function projectSequenceSteps(
  graph: SoftwareGraph | null | undefined,
  routeNodeId?: string | null,
): SequenceStep[] {
  if (!graph) return [];
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const observedTargets = new Set(
    graph.edges
      .filter((edge) => edge.metadata?.provenance === "observed")
      .flatMap((edge) => [edge.sourceId, edge.targetId]),
  );

  const group =
    graph.groups.find(
      (entry) =>
        entry.id.startsWith("execution:") &&
        (!routeNodeId || entry.nodeIds.includes(routeNodeId)),
    ) ?? graph.groups.find((entry) => entry.id.startsWith("execution:"));

  if (!group || group.nodeIds.length === 0) return [];

  return group.nodeIds
    .map((id) => nodeById.get(id))
    .filter((node): node is SoftwareGraphNode => Boolean(node))
    .map((node) => ({
      id: node.id,
      label: node.label,
      observed: observedTargets.has(node.id) || node.metadata?.runtimeObserved === true,
    }));
}
