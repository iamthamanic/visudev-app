/**
 * RVP-8 semantic Execution pipeline — evidenced stations only, no invented steps.
 * Location: src/modules/blueprint/components/execution/execution-usecase-pipeline.ts
 */

import type { SemanticSystemModel } from "../../../../../shared/semantic-system-model.types.js";
import type {
  SoftwareGraph,
  SoftwareGraphEdge,
  SoftwareGraphEvidence,
  SoftwareGraphNode,
} from "../../types";

/** Canonical station order for route-to-use-case pipelines. */
export const EXECUTION_STATION_ORDER = [
  "trigger",
  "validation",
  "auth",
  "handler",
  "use-case",
  "data",
  "external",
] as const;

export type ExecutionStationKind = (typeof EXECUTION_STATION_ORDER)[number];

export interface ExecutionPipelineStep {
  id: string;
  station: ExecutionStationKind;
  label: string;
  nodeId: string;
  evidenceIds: string[];
  /** Always null without runtime telemetry (Honest-Core). */
  durationMs: null;
}

export interface ExecutionUseCasePipeline {
  routeId: string;
  steps: ExecutionPipelineStep[];
}

const EVIDENCED_EDGE_KINDS = new Set([
  "calls",
  "api",
  "authenticates",
  "validates",
  "data",
  "references",
  "implements",
  "external-dependency",
  "event",
]);

function evidenceForNode(graph: SoftwareGraph, node: SoftwareGraphNode): SoftwareGraphEvidence[] {
  const evidence = Array.isArray(graph.evidence) ? graph.evidence : [];
  return evidence.filter((item) => {
    if (item.nodeId === node.id) return true;
    if (node.filePath && item.filePath === node.filePath) {
      if (node.line == null) return true;
      return item.line === node.line;
    }
    return false;
  });
}

function nodeHasEvidence(graph: SoftwareGraph, node: SoftwareGraphNode): boolean {
  if (evidenceForNode(graph, node).length > 0) return true;
  // Route / symbol nodes with a file path count as statically evidenced.
  if (typeof node.filePath === "string" && node.filePath.length > 0) return true;
  if (node.metadata?.runtimeObserved === true) return true;
  return false;
}

function classifyStation(node: SoftwareGraphNode): ExecutionStationKind | null {
  const label = `${node.label} ${node.filePath ?? ""} ${node.kind}`.toLowerCase();
  const metaType = typeof node.metadata?.type === "string" ? node.metadata.type.toLowerCase() : "";

  if (node.kind === "route" || metaType.includes("trigger")) return "trigger";
  if (
    node.kind === "external" ||
    /external|webhook|queue|event/.test(label) ||
    metaType.includes("external")
  ) {
    return "external";
  }
  if (node.kind === "table" || node.kind === "repository" || /repo|store|prisma|db/.test(label)) {
    return "data";
  }
  if (/auth|session|guard|middleware\/auth|requireauth/.test(label) || metaType.includes("auth")) {
    return "auth";
  }
  if (/validat|zod|schema|sanitize|dto/.test(label) || metaType.includes("validat")) {
    return "validation";
  }
  if (
    node.kind === "service" ||
    /use-?case|application\/|\/services\//.test(label) ||
    metaType.includes("use case") ||
    metaType.includes("use-case")
  ) {
    return "use-case";
  }
  if (
    node.kind === "module" ||
    node.kind === "file" ||
    node.kind === "symbol" ||
    /controller|handler|route\.|router|endpoint/.test(label)
  ) {
    return "handler";
  }
  return null;
}

function findRouteNode(graph: SoftwareGraph, routeId: string): SoftwareGraphNode | undefined {
  return graph.nodes.find(
    (node) =>
      node.kind === "route" &&
      (node.metadata.routeId === routeId || node.id === routeId || node.id === `route:${routeId}`),
  );
}

function evidencedNeighbors(
  graph: SoftwareGraph,
  fromId: string,
): { edge: SoftwareGraphEdge; node: SoftwareGraphNode }[] {
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const out: { edge: SoftwareGraphEdge; node: SoftwareGraphNode }[] = [];
  for (const edge of graph.edges) {
    if (!EVIDENCED_EDGE_KINDS.has(edge.kind)) continue;
    if (edge.sourceId !== fromId && edge.targetId !== fromId) continue;
    const otherId = edge.sourceId === fromId ? edge.targetId : edge.sourceId;
    const node = nodeById.get(otherId);
    if (!node) continue;
    if (!nodeHasEvidence(graph, node)) continue;
    out.push({ edge, node });
  }
  return out;
}

function stationRank(station: ExecutionStationKind): number {
  return EXECUTION_STATION_ORDER.indexOf(station);
}

/**
 * Walk evidenced relations from a route, classify stations, dedupe by station kind.
 * Missing stations are omitted — never invented.
 */
export function buildExecutionUseCasePipeline(
  graph: SoftwareGraph,
  routeId: string,
  semantic?: SemanticSystemModel | null,
): ExecutionUseCasePipeline | null {
  const routeNode = findRouteNode(graph, routeId);
  if (!routeNode || !nodeHasEvidence(graph, routeNode)) return null;

  const bestByStation = new Map<ExecutionStationKind, ExecutionPipelineStep>();

  const triggerEvidence = evidenceForNode(graph, routeNode);
  bestByStation.set("trigger", {
    id: `station:trigger:${routeNode.id}`,
    station: "trigger",
    label: routeNode.label,
    nodeId: routeNode.id,
    evidenceIds:
      triggerEvidence.length > 0
        ? triggerEvidence.map((item) => item.id)
        : [`file:${routeNode.filePath ?? routeNode.id}`],
    durationMs: null,
  });

  // Prefer semantic use-case entities that already backlink to graph nodes.
  if (semantic) {
    const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
    for (const entity of semantic.entities) {
      if (entity.kind !== "use-case" && entity.kind !== "execution-flow") continue;
      const membership = semantic.memberships.find(
        (item) => item.semanticEntityId === entity.id && nodeById.has(item.graphNodeId),
      );
      if (!membership) continue;
      const node = nodeById.get(membership.graphNodeId);
      if (!node || !nodeHasEvidence(graph, node)) continue;
      if (bestByStation.has("use-case")) continue;
      const evidence = evidenceForNode(graph, node);
      bestByStation.set("use-case", {
        id: `station:use-case:${node.id}`,
        station: "use-case",
        label: entity.label || node.label,
        nodeId: node.id,
        evidenceIds:
          evidence.length > 0
            ? evidence.map((item) => item.id)
            : [`file:${node.filePath ?? node.id}`],
        durationMs: null,
      });
    }
  }

  const visited = new Set<string>([routeNode.id]);
  const queue: string[] = [routeNode.id];

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const { node } of evidencedNeighbors(graph, current)) {
      if (visited.has(node.id)) continue;
      visited.add(node.id);
      queue.push(node.id);

      const station = classifyStation(node);
      if (!station || station === "trigger") continue;

      const evidence = evidenceForNode(graph, node);
      const evidenceIds =
        evidence.length > 0
          ? evidence.map((item) => item.id)
          : [`file:${node.filePath ?? node.id}`];

      const candidate: ExecutionPipelineStep = {
        id: `station:${station}:${node.id}`,
        station,
        label: node.label,
        nodeId: node.id,
        evidenceIds,
        durationMs: null,
      };

      const existing = bestByStation.get(station);
      // Deduplicate: keep first evidenced node per station (semantic condensation).
      if (!existing) {
        bestByStation.set(station, candidate);
      }
    }
  }

  // Also fold execution:* group members that have evidence (ordered by station).
  const routeKey =
    typeof routeNode.metadata.routeId === "string" && routeNode.metadata.routeId.length > 0
      ? routeNode.metadata.routeId
      : routeNode.id;
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  for (const group of graph.groups ?? []) {
    if (!group.id.startsWith(`execution:${routeKey}:`)) continue;
    for (const nodeId of group.nodeIds) {
      const node = nodeById.get(nodeId);
      if (!node || !nodeHasEvidence(graph, node)) continue;
      const station = classifyStation(node);
      if (!station) continue;
      if (bestByStation.has(station)) continue;
      const evidence = evidenceForNode(graph, node);
      bestByStation.set(station, {
        id: `station:${station}:${node.id}`,
        station,
        label: node.label,
        nodeId: node.id,
        evidenceIds:
          evidence.length > 0
            ? evidence.map((item) => item.id)
            : [`file:${node.filePath ?? node.id}`],
        durationMs: null,
      });
    }
  }

  const steps = EXECUTION_STATION_ORDER.map((station) => bestByStation.get(station)).filter(
    (step): step is ExecutionPipelineStep => step != null,
  );

  if (steps.length < 1) return null;
  // Prefer pipelines that progressed beyond the bare trigger when possible.
  return { routeId: routeKey, steps };
}

export function pipelineToStepNodeIds(pipeline: ExecutionUseCasePipeline): string[] {
  return pipeline.steps.map((step) => step.nodeId);
}

/** Stable sort helper exported for tests. */
export function compareStations(left: ExecutionStationKind, right: ExecutionStationKind): number {
  return stationRank(left) - stationRank(right);
}
