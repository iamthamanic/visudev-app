/**
 * Projects SoftwareGraph execution path groups into a left-to-right pipeline graph.
 */

import type {
  GraphCanvasEdge,
  GraphCanvasNode,
  SoftwareGraph,
  SoftwareGraphGroup,
  SoftwareGraphNode,
} from "../../types";

export interface ExecutionProjectionOptions {
  routeId: string;
}

export interface ExecutionProjection {
  nodes: GraphCanvasNode[];
  edges: GraphCanvasEdge[];
  stepNodeIds: string[];
  cycleNodeId: string | null;
}

function findExecutionGroups(graph: SoftwareGraph, routeId: string): SoftwareGraphGroup[] {
  const groups = Array.isArray(graph.groups) ? graph.groups : [];
  return groups
    .filter((group) => group.id.startsWith(`execution:${routeId}:`))
    .sort((left, right) => left.id.localeCompare(right.id));
}

function findRouteNode(graph: SoftwareGraph, routeId: string): SoftwareGraphNode | undefined {
  return graph.nodes.find(
    (node) =>
      node.kind === "route" &&
      (node.metadata.routeId === routeId || node.id === routeId || node.id === `route:${routeId}`),
  );
}

function toCanvasNode(node: SoftwareGraphNode, cycleNodeId: string | null): GraphCanvasNode {
  const isCycle = cycleNodeId != null && node.id === cycleNodeId;
  return {
    id: node.id,
    label: node.label,
    kind: node.kind,
    ...(isCycle ? { color: "var(--color-destructive)" } : {}),
  };
}

function isLeaveRouteSample(label: string, filePath: string, path: string): boolean {
  const normalized = `${label} ${filePath} ${path}`.toLowerCase().replace(/\\/g, "/");
  return (
    normalized.includes("/leaves/") ||
    normalized.includes("/leave/") ||
    /(?:^|\/)leaves?(?:\/|\.|$)/.test(normalized) ||
    /\/api\/leaves?(?:\/|$)/.test(normalized)
  );
}

export function listExecutionRoutes(graph: SoftwareGraph): { routeId: string; label: string }[] {
  const routes = graph.nodes
    .filter((node) => node.kind === "route")
    .map((node) => ({
      routeId:
        typeof node.metadata.routeId === "string" && node.metadata.routeId.length > 0
          ? node.metadata.routeId
          : node.id,
      label: node.label,
      filePath: node.filePath ?? "",
      path: typeof node.metadata.path === "string" ? node.metadata.path : "",
    }))
    .sort((a, b) => {
      // Stable partition only — preserve non-leave insertion order.
      const aLeave = isLeaveRouteSample(a.label, a.filePath, a.path) ? 0 : 1;
      const bLeave = isLeaveRouteSample(b.label, b.filePath, b.path) ? 0 : 1;
      return aLeave - bLeave;
    })
    .map(({ routeId, label }) => ({ routeId, label }));
  if (routes.length > 0) return routes;

  // Honest non-HTTP surface (e.g. Meteor) when no HTTP routes were extracted.
  const nonHttp = (Array.isArray(graph.groups) ? graph.groups : []).find(
    (group) => group.id === "execution:non-http:0",
  );
  if (nonHttp) {
    return [{ routeId: "non-http", label: nonHttp.label }];
  }
  return [];
}

export function projectExecutionGraph(
  graph: SoftwareGraph,
  options: ExecutionProjectionOptions,
): ExecutionProjection | null {
  if (options.routeId === "non-http") {
    const group = (Array.isArray(graph.groups) ? graph.groups : []).find(
      (entry) => entry.id === "execution:non-http:0",
    );
    if (!group) return null;
    const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
    const stepNodeIds = group.nodeIds.filter((id) => nodeById.has(id));
    return {
      nodes: stepNodeIds.map((id) => toCanvasNode(nodeById.get(id)!, null)),
      edges: stepNodeIds.slice(1).map((targetId, index) => ({
        id: `exec-edge-${index}`,
        source: stepNodeIds[index]!,
        target: targetId,
        kind: "executes",
      })),
      stepNodeIds,
      cycleNodeId: null,
    };
  }

  const routeNode = findRouteNode(graph, options.routeId);
  if (!routeNode) return null;

  const routeKey =
    typeof routeNode.metadata.routeId === "string" && routeNode.metadata.routeId.length > 0
      ? routeNode.metadata.routeId
      : routeNode.id;

  const executionGroups = findExecutionGroups(graph, routeKey);
  const selectedGroup =
    executionGroups[0] ??
    ({
      id: `execution:${routeKey}:0`,
      kind: "route",
      label: routeNode.label,
      nodeIds: [routeNode.id],
    } satisfies SoftwareGraphGroup);

  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const cycleNodeId =
    typeof routeNode.metadata.executionCycleNodeId === "string"
      ? routeNode.metadata.executionCycleNodeId
      : null;

  const stepNodeIds = selectedGroup.nodeIds.filter((nodeId) => nodeById.has(nodeId));
  const nodes = stepNodeIds
    .map((nodeId) => nodeById.get(nodeId))
    .filter((node): node is SoftwareGraphNode => node != null)
    .map((node) => toCanvasNode(node, cycleNodeId));

  const edges: GraphCanvasEdge[] = [];
  for (let index = 1; index < stepNodeIds.length; index += 1) {
    const source = stepNodeIds[index - 1];
    const target = stepNodeIds[index];
    edges.push({
      id: `execution-step:${source}->${target}`,
      source,
      target,
      kind: "executes",
      label: "→",
    });
  }

  return { nodes, edges, stepNodeIds, cycleNodeId };
}

export function findStepEvidence(graph: SoftwareGraph, nodeId: string | null) {
  if (!nodeId) return [];
  const node = graph.nodes.find((candidate) => candidate.id === nodeId);
  if (!node) return [];

  const filePath = node.filePath;
  const evidence = Array.isArray(graph.evidence) ? graph.evidence : [];
  return evidence.filter((item) => {
    if (item.nodeId === nodeId) return true;
    if (filePath == null || item.filePath !== filePath) return false;
    if (node.line == null) return true;
    return item.line === node.line;
  });
}

export interface StepTiming {
  nodeId: string;
  /** Null when the graph has no measured durationMs (Honest-Core P0-4). */
  durationMs: number | null;
  startMs: number;
  endMs: number;
}

export interface ExecutionMetrics {
  totalDurationMs: number;
  stepCount: number;
  errorCount: number;
  warningCount: number;
  serviceCount: number;
  dbCount: number;
  eventCount: number;
  payloadCount: number;
}

export function resolveStepDurationMs(node: SoftwareGraphNode | undefined): number | null {
  const fromMeta = node?.metadata?.durationMs;
  if (typeof fromMeta === "number" && Number.isFinite(fromMeta) && fromMeta >= 0) {
    return Math.round(fromMeta);
  }
  return null;
}

export function computeStepTimings(graph: SoftwareGraph, stepNodeIds: string[]): StepTiming[] {
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  let cursorMs = 0;
  return stepNodeIds.map((nodeId) => {
    const durationMs = resolveStepDurationMs(nodeById.get(nodeId));
    const startMs = cursorMs;
    const measured = durationMs ?? 0;
    const endMs = cursorMs + measured;
    cursorMs = endMs;
    return { nodeId, durationMs, startMs, endMs };
  });
}

export function computeExecutionMetrics(
  projection: ExecutionProjection | null,
  graph: SoftwareGraph,
): ExecutionMetrics {
  const empty: ExecutionMetrics = {
    totalDurationMs: 0,
    stepCount: 0,
    errorCount: 0,
    warningCount: 0,
    serviceCount: 0,
    dbCount: 0,
    eventCount: 0,
    payloadCount: 0,
  };

  if (!projection || projection.stepNodeIds.length === 0) {
    return empty;
  }

  const timings = computeStepTimings(graph, projection.stepNodeIds);
  const totalDurationMs = timings.at(-1)?.endMs ?? 0;
  let errorCount = projection.cycleNodeId != null ? 1 : 0;
  let warningCount = 0;
  let serviceCount = 0;
  let dbCount = 0;
  let eventCount = 0;

  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  for (const nodeId of projection.stepNodeIds) {
    const node = nodeById.get(nodeId);
    if (!node) continue;
    const status = node.metadata?.status;
    if (status === "error" || status === "failed" || node.metadata?.error === true) {
      errorCount += 1;
    }
    if (status === "warning") warningCount += 1;
    if (node.kind === "service") serviceCount += 1;
    if (node.kind === "table") dbCount += 1;
    if (node.kind === "external" || node.metadata?.type === "Worker") eventCount += 1;
  }

  const evidence = Array.isArray(graph.evidence) ? graph.evidence : [];
  const payloadCount = evidence.filter((item) => /payload/i.test(item.kind)).length;

  return {
    totalDurationMs,
    stepCount: projection.stepNodeIds.length,
    errorCount,
    warningCount,
    serviceCount,
    dbCount,
    eventCount,
    payloadCount,
  };
}

const TERMINAL_EXECUTION_STATUSES = new Set([
  "completed",
  "complete",
  "done",
  "success",
  "failed",
  "cancelled",
  "idle",
  "stopped",
]);

function normalizedExecutionStatus(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

export function isExecutionLive(graph: SoftwareGraph, routeId: string): boolean {
  const routeNode = findRouteNode(graph, routeId);
  const executionStatus = normalizedExecutionStatus(routeNode?.metadata?.executionStatus);
  const routeStatus = normalizedExecutionStatus(routeNode?.metadata?.status);

  if (executionStatus === "running" || routeStatus === "running") return true;
  if (executionStatus && TERMINAL_EXECUTION_STATUSES.has(executionStatus)) return false;
  if (routeStatus && TERMINAL_EXECUTION_STATUSES.has(routeStatus)) return false;

  const projection = projectExecutionGraph(graph, { routeId });
  if (!projection) return false;

  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  return projection.stepNodeIds.some((nodeId) => {
    const node = nodeById.get(nodeId);
    const stepStatus = normalizedExecutionStatus(node?.metadata?.executionStatus);
    const nodeStatus = normalizedExecutionStatus(node?.metadata?.status);
    return stepStatus === "running" || nodeStatus === "running";
  });
}
