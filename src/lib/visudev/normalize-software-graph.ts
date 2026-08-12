/**
 * Orchestrates SoftwareGraph normalization from untrusted Blueprint KV payloads.
 */

import type {
  SoftwareGraph,
  SoftwareGraphEdge,
  SoftwareGraphEvidence,
  SoftwareGraphGroup,
  SoftwareGraphNode,
} from "./software-graph-types";
import {
  boundedArray,
  boundedString,
  isIsoTimestamp,
  isRecord,
  isSoftwareGraphNodeKind,
  isSoftwareGraphEdge,
  isSoftwareGraphNode,
  MAX_EDGES,
  MAX_NODES,
} from "./normalize-graph-guards";
import { sanitizeEdge, sanitizeNode } from "./normalize-graph-sanitize";

function boundedNodeSignatures(value: unknown): Record<string, string> | undefined {
  if (!isRecord(value)) return undefined;
  const entries = Object.entries(value)
    .filter(
      (entry): entry is [string, string] =>
        typeof entry[0] === "string" && typeof entry[1] === "string",
    )
    .slice(0, MAX_NODES)
    .map(([key, signature]) => {
      const boundedKey = boundedString(key, 128);
      const boundedSignature = boundedString(signature, 256);
      if (!boundedKey || !boundedSignature) return null;
      return [boundedKey, boundedSignature] as const;
    })
    .filter((entry): entry is readonly [string, string] => entry != null);
  if (entries.length === 0) return undefined;
  return Object.fromEntries(entries);
}

function isBoundedNodeId(value: unknown): value is string {
  return typeof value === "string" && boundedString(value, 128) === value;
}

function normalizeSnapshotSourceKind(value: unknown): "git" | "filesystem" | undefined {
  if (value === "git" || value === "filesystem") return value;
  return undefined;
}

function isBoundedEvidence(value: unknown): value is SoftwareGraphEvidence {
  if (!isRecord(value)) return false;
  const id = boundedString(value.id, 128);
  const factId = boundedString(value.factId, 128);
  const kind = boundedString(value.kind, 64);
  const filePath = boundedString(value.filePath, 512);
  const excerpt = boundedString(value.excerpt, 512);
  return Boolean(id && factId && kind && filePath && excerpt && positiveLine(value.line));
}

function positiveLine(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1;
}

function sanitizeGroups(raw: unknown, nodeIds: Set<string>): SoftwareGraphGroup[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .filter((item) => isRecord(item))
    .slice(0, 100)
    .map((item) => {
      const id = boundedString(item.id, 128);
      const kind = boundedString(item.kind, 64);
      const label = boundedString(item.label);
      if (!id || !kind || !label || !isSoftwareGraphNodeKind(kind)) return null;

      const groupNodeIds = boundedArray(item.nodeIds, MAX_NODES, isBoundedNodeId).filter((nodeId) =>
        nodeIds.has(nodeId),
      );
      if (groupNodeIds.length === 0) return null;

      return {
        id,
        kind,
        label,
        nodeIds: groupNodeIds,
      };
    })
    .filter((group): group is SoftwareGraphGroup => group != null);
}

export function normalizeSoftwareGraph(raw: unknown): SoftwareGraph | undefined {
  if (!isRecord(raw)) return undefined;
  if (raw.version != null && raw.version !== 1) return undefined;
  if (!Array.isArray(raw.nodes) || !Array.isArray(raw.edges)) return undefined;

  const rawNodeList = boundedArray(raw.nodes, MAX_NODES, isSoftwareGraphNode);
  const nodes: SoftwareGraphNode[] = [];
  const seenNodeIds = new Set<string>();

  for (const rawNode of rawNodeList) {
    const node = sanitizeNode(rawNode);
    if (!node || seenNodeIds.has(node.id)) continue;
    seenNodeIds.add(node.id);
    nodes.push(node);
  }

  const nodeIds = new Set(nodes.map((node) => node.id));
  const rawEdgeList = boundedArray(raw.edges, MAX_EDGES, isSoftwareGraphEdge);
  const edges: SoftwareGraphEdge[] = [];
  const seenEdgeIds = new Set<string>();

  for (const rawEdge of rawEdgeList) {
    const edge = sanitizeEdge(rawEdge);
    if (!edge) continue;
    if (!nodeIds.has(edge.sourceId) || !nodeIds.has(edge.targetId)) continue;
    if (nodeIds.has(edge.id) || seenEdgeIds.has(edge.id)) continue;
    seenEdgeIds.add(edge.id);
    edges.push(edge);
  }

  if (nodes.length === 0 && edges.length === 0) return undefined;

  const projectId = boundedString(raw.projectId);
  const analyzedAt = boundedString(raw.analyzedAt, 64);
  if (!projectId || !analyzedAt || !isIsoTimestamp(analyzedAt)) return undefined;

  const snapshots = Array.isArray(raw.snapshots)
    ? raw.snapshots
        .filter((item) => isRecord(item))
        .slice(0, 20)
        .map((item) => {
          const id = boundedString(item.id, 128);
          if (!id) return null;
          const capturedAtRaw = boundedString(item.capturedAt, 64);
          const capturedAt =
            capturedAtRaw && isIsoTimestamp(capturedAtRaw) ? capturedAtRaw : analyzedAt;
          return {
            id,
            label: boundedString(item.label) ?? id,
            ref: boundedString(item.ref) ?? id,
            capturedAt,
            nodeIds: boundedArray(item.nodeIds, MAX_NODES, isBoundedNodeId),
            commitSha: boundedString(item.commitSha, 64),
            branch: boundedString(item.branch, 120),
            sourceKind: normalizeSnapshotSourceKind(item.sourceKind),
            dirty: typeof item.dirty === "boolean" ? item.dirty : undefined,
            nodeSignatures: boundedNodeSignatures(item.nodeSignatures),
          };
        })
        .filter((snapshot): snapshot is NonNullable<typeof snapshot> => snapshot != null)
    : undefined;

  const evidence = Array.isArray(raw.evidence)
    ? boundedArray(raw.evidence, 10_000, isBoundedEvidence).map((item) => {
        const nodeIdRaw = boundedString(item.nodeId, 128);
        const nodeId = nodeIdRaw && nodeIds.has(nodeIdRaw) ? nodeIdRaw : undefined;
        return {
          id: boundedString(item.id, 128) ?? "",
          factId: boundedString(item.factId, 128) ?? "",
          kind: boundedString(item.kind, 64) ?? "",
          filePath: boundedString(item.filePath, 512) ?? "",
          line: item.line,
          excerpt: boundedString(item.excerpt, 512) ?? "",
          nodeId,
        };
      })
    : [];

  const groups = sanitizeGroups(raw.groups, nodeIds);

  const ALLOWED_METRIC_NAMES = new Set(["modules", "files", "coverage"]);
  const MAX_METRIC_VALUE = 1_000_000;
  const metrics = Array.isArray(raw.metrics)
    ? raw.metrics
        .map((metricEntry) => {
          if (!isRecord(metricEntry)) return null;
          const metricId = boundedString(metricEntry.id, 128);
          const metricName = boundedString(metricEntry.name, 64);
          const metricValue =
            typeof metricEntry.value === "number" && Number.isFinite(metricEntry.value)
              ? metricEntry.value
              : null;
          if (!metricId || !metricName || metricValue == null) return null;
          if (!ALLOWED_METRIC_NAMES.has(metricName)) return null;
          const boundedValue = Math.min(MAX_METRIC_VALUE, Math.max(0, Math.round(metricValue)));
          return { id: metricId, name: metricName, value: boundedValue };
        })
        .filter(
          (metricEntry): metricEntry is NonNullable<typeof metricEntry> => metricEntry != null,
        )
        .slice(0, 16)
    : [];

  return {
    version: 1,
    projectId,
    analyzedAt,
    scopes: [],
    nodes,
    edges,
    evidence,
    groups,
    metrics,
    condensed: false,
    limits: {
      maxNodes: MAX_NODES,
      maxEdges: MAX_EDGES,
    },
    snapshots,
  };
}
