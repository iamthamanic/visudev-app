/**
 * Maps SoftwareGraph dependency edges into DependenciesView canvas nodes and edges.
 * Includes isolated (orphan) nodes so the view is not limited to edge endpoints.
 */

import type {
  GraphCanvasEdge,
  GraphCanvasNode,
  SoftwareGraph,
  SoftwareGraphEdge,
  SoftwareGraphEvidence,
  SoftwareGraphNode,
} from "../../types";
import {
  DEFAULT_VISIBLE_DEPENDENCY_KINDS,
  DEPENDENCY_EDGE_KINDS,
  DEPENDENCY_EDGE_LABELS,
  RELATIONSHIP_LABELS,
  resolveDependencyKindFromGraphEdge,
  type DependencyEdgeKind,
} from "./_projection.constants.js";

export {
  DEFAULT_VISIBLE_DEPENDENCY_KINDS,
  DEPENDENCY_EDGE_KINDS,
  DEPENDENCY_EDGE_LABELS,
  RELATIONSHIP_LABELS,
  type DependencyEdgeKind,
} from "./_projection.constants.js";

const MAX_DEPENDENCY_LABEL_LEN = 48;

const NODE_KIND_LABELS: Partial<Record<SoftwareGraphNode["kind"], string>> = {
  file: "Datei",
  module: "Modul",
  service: "Service",
  route: "Route",
  domain: "Domain",
  symbol: "Symbol",
  repository: "Repository",
  external: "Externer Service",
};

function readNodeTypeBadge(node: SoftwareGraphNode): string {
  const fromMetadata = node.metadata?.type;
  if (typeof fromMetadata === "string" && fromMetadata.trim().length > 0) {
    return fromMetadata.trim();
  }
  return NODE_KIND_LABELS[node.kind] ?? node.kind;
}

function formatNodeCardLabel(node: SoftwareGraphNode): string {
  const title = truncateLabel(node.label);
  const typeBadge = readNodeTypeBadge(node);
  const filePath =
    typeof node.filePath === "string"
      ? node.filePath
      : typeof node.metadata?.filePath === "string"
        ? node.metadata.filePath
        : null;
  const lines = [title, typeBadge];
  if (filePath) lines.push(truncateLabel(filePath));
  return lines.join("\n");
}

export interface DependenciesProjectionOptions {
  visibleEdgeKinds?: Set<DependencyEdgeKind>;
}

export const ORPHAN_NODE_COLOR = "var(--color-muted-foreground)";

export interface DependenciesProjection {
  nodes: GraphCanvasNode[];
  edges: GraphCanvasEdge[];
  /** Nodes with no visible dependency edge (Honest-Core P1-1). */
  orphanNodeIds: string[];
}

function truncateLabel(label: string): string {
  const trimmed = label.trim();
  if (trimmed.length <= MAX_DEPENDENCY_LABEL_LEN) return trimmed;
  return `${trimmed.slice(0, MAX_DEPENDENCY_LABEL_LEN - 1)}…`;
}

function toCanvasNode(node: SoftwareGraphNode, isOrphan: boolean): GraphCanvasNode {
  return {
    id: node.id,
    label: formatNodeCardLabel(node),
    kind: node.kind,
    color: isOrphan ? ORPHAN_NODE_COLOR : undefined,
  };
}

function toCanvasEdge(edge: SoftwareGraphEdge): GraphCanvasEdge {
  const dependencyKind = resolveDependencyKindFromGraphEdge(edge.kind);
  const edgeLabel = dependencyKind
    ? RELATIONSHIP_LABELS[dependencyKind]
    : edge.kind in DEPENDENCY_EDGE_LABELS
      ? DEPENDENCY_EDGE_LABELS[edge.kind as DependencyEdgeKind]
      : edge.kind;
  return {
    id: edge.id,
    source: edge.sourceId,
    target: edge.targetId,
    kind: dependencyKind ?? edge.kind,
    label: edgeLabel,
  };
}

function resolveVisibleEdgeKinds(
  visibleEdgeKinds: Set<DependencyEdgeKind> | undefined,
): Set<DependencyEdgeKind> {
  if (visibleEdgeKinds === undefined) {
    return new Set(DEFAULT_VISIBLE_DEPENDENCY_KINDS);
  }
  return new Set(visibleEdgeKinds);
}

export function projectDependenciesGraph(
  graph: SoftwareGraph,
  options: DependenciesProjectionOptions = {},
): DependenciesProjection {
  const graphNodes = Array.isArray(graph.nodes) ? graph.nodes : [];
  const graphEdges = Array.isArray(graph.edges) ? graph.edges : [];
  const nodeById = new Map(graphNodes.map((node) => [node.id, node]));
  const visibleKinds = resolveVisibleEdgeKinds(options.visibleEdgeKinds);

  const dependencyEdges = graphEdges.filter((edge) => {
    const mapped = resolveDependencyKindFromGraphEdge(edge.kind);
    return mapped != null && visibleKinds.has(mapped);
  });

  const connectedNodeIds = new Set<string>();
  for (const edge of dependencyEdges) {
    if (nodeById.has(edge.sourceId)) connectedNodeIds.add(edge.sourceId);
    if (nodeById.has(edge.targetId)) connectedNodeIds.add(edge.targetId);
  }

  const orphanNodeIds: string[] = [];
  const nodes: GraphCanvasNode[] = [];
  for (const node of graphNodes) {
    const isOrphan = !connectedNodeIds.has(node.id);
    if (isOrphan) orphanNodeIds.push(node.id);
    nodes.push(toCanvasNode(node, isOrphan));
  }

  const visibleNodeIds = new Set(nodes.map((node) => node.id));
  const edges = dependencyEdges
    .filter((edge) => visibleNodeIds.has(edge.sourceId) && visibleNodeIds.has(edge.targetId))
    .map(toCanvasEdge);

  return { nodes, edges, orphanNodeIds };
}

export function applyOrphanFilter(
  projection: DependenciesProjection,
  showOrphans: boolean,
): DependenciesProjection {
  if (showOrphans) return projection;
  const orphanSet = new Set(projection.orphanNodeIds);
  return {
    nodes: projection.nodes.filter((node) => !orphanSet.has(node.id)),
    edges: projection.edges,
    orphanNodeIds: [],
  };
}

export function findCentralDependencyNodeId(
  graph: SoftwareGraph,
  options: DependenciesProjectionOptions = {},
): string | null {
  const projected = projectDependenciesGraph(graph, options);
  if (projected.nodes.length === 0) return null;

  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const degree = new Map<string, number>();
  for (const edge of projected.edges) {
    degree.set(edge.source, (degree.get(edge.source) ?? 0) + 1);
    degree.set(edge.target, (degree.get(edge.target) ?? 0) + 1);
  }

  let bestId = projected.nodes[0].id;
  let bestScore = -1;
  for (const node of projected.nodes) {
    const score = degree.get(node.id) ?? 0;
    const isUseCase = nodeById.get(node.id)?.metadata?.type === "Use Case";
    const adjusted = score + (isUseCase ? 100 : 0);
    if (adjusted > bestScore) {
      bestScore = adjusted;
      bestId = node.id;
    }
  }
  return bestId;
}

export interface NodeDependencyCounts {
  incoming: number;
  outgoing: number;
}

export interface TopNodeDependency {
  edgeId: string;
  label: string;
  kind: DependencyEdgeKind;
  direction: "incoming" | "outgoing";
}

export interface NodeDependencySummary extends NodeDependencyCounts {
  neighbors: TopNodeDependency[];
}

export interface DependenciesGraphIndex {
  nodeById: Map<string, SoftwareGraphNode>;
  edgeById: Map<string, SoftwareGraphEdge>;
  evidenceByEdgeId: Map<string, SoftwareGraphEvidence[]>;
  summariesByNodeId: Map<string, NodeDependencySummary>;
}

const EMPTY_NODE_SUMMARY: NodeDependencySummary = { incoming: 0, outgoing: 0, neighbors: [] };

function addEvidenceToBucket(
  buckets: Map<string, SoftwareGraphEvidence[]>,
  seenIds: Map<string, Set<string>>,
  bucketKey: string,
  item: SoftwareGraphEvidence,
): void {
  let ids = seenIds.get(bucketKey);
  if (!ids) {
    ids = new Set();
    seenIds.set(bucketKey, ids);
    buckets.set(bucketKey, []);
  }
  if (ids.has(item.id)) return;
  ids.add(item.id);
  buckets.get(bucketKey)!.push(item);
}

function mergeEvidenceBuckets(
  buckets: Map<string, SoftwareGraphEvidence[]>,
  seenIds: Map<string, Set<string>>,
  targetKey: string,
  sourceItems: SoftwareGraphEvidence[],
): void {
  for (const item of sourceItems) {
    addEvidenceToBucket(buckets, seenIds, targetKey, item);
  }
}

export function buildDependenciesGraphIndex(
  graph: SoftwareGraph,
  neighborLimit = 5,
): DependenciesGraphIndex {
  const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
  const graphEdges = Array.isArray(graph.edges) ? graph.edges : [];
  const graphEvidence = Array.isArray(graph.evidence) ? graph.evidence : [];

  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const edgeById = new Map(graphEdges.map((edge) => [edge.id, edge]));
  const evidenceByEdgeId = new Map<string, SoftwareGraphEvidence[]>();
  const evidenceByFactId = new Map<string, SoftwareGraphEvidence[]>();
  const edgeEvidenceSeenIds = new Map<string, Set<string>>();
  const factEvidenceSeenIds = new Map<string, Set<string>>();

  for (const item of graphEvidence) {
    if (item.edgeId) {
      addEvidenceToBucket(evidenceByEdgeId, edgeEvidenceSeenIds, item.edgeId, item);
    }
    if (item.factId) {
      addEvidenceToBucket(evidenceByFactId, factEvidenceSeenIds, item.factId, item);
    }
  }

  for (const edge of graphEdges) {
    const factId = edge.metadata?.evidenceFactId;
    if (typeof factId !== "string") continue;
    const linked = evidenceByFactId.get(factId);
    if (!linked) continue;
    mergeEvidenceBuckets(evidenceByEdgeId, edgeEvidenceSeenIds, edge.id, linked);
  }

  const summariesByNodeId = new Map<string, NodeDependencySummary>();
  for (const node of nodes) {
    summariesByNodeId.set(node.id, { incoming: 0, outgoing: 0, neighbors: [] });
  }

  for (const edge of graphEdges) {
    const dependencyKind = resolveDependencyKindFromGraphEdge(edge.kind);
    if (!dependencyKind) continue;

    if (nodeById.has(edge.sourceId) && nodeById.has(edge.targetId)) {
      const sourceSummary = summariesByNodeId.get(edge.sourceId);
      if (sourceSummary) {
        sourceSummary.outgoing += 1;
        if (sourceSummary.neighbors.length < neighborLimit) {
          const target = nodeById.get(edge.targetId);
          sourceSummary.neighbors.push({
            edgeId: edge.id,
            label: target?.label ?? edge.targetId,
            kind: dependencyKind,
            direction: "outgoing",
          });
        }
      }
    }

    if (nodeById.has(edge.targetId) && nodeById.has(edge.sourceId)) {
      const targetSummary = summariesByNodeId.get(edge.targetId);
      if (targetSummary) {
        targetSummary.incoming += 1;
        if (targetSummary.neighbors.length < neighborLimit) {
          const source = nodeById.get(edge.sourceId);
          targetSummary.neighbors.push({
            edgeId: edge.id,
            label: source?.label ?? edge.sourceId,
            kind: dependencyKind,
            direction: "incoming",
          });
        }
      }
    }
  }

  return { nodeById, edgeById, evidenceByEdgeId, summariesByNodeId };
}

export function getNodeDependencySummaryFromIndex(
  index: DependenciesGraphIndex,
  nodeId: string,
): NodeDependencySummary {
  return index.summariesByNodeId.get(nodeId) ?? EMPTY_NODE_SUMMARY;
}

export function getEdgeEvidenceFromIndex(
  index: DependenciesGraphIndex,
  edgeId: string | null,
): { edge: SoftwareGraphEdge; evidence: SoftwareGraphEvidence[] } | null {
  if (!edgeId) return null;
  const edge = index.edgeById.get(edgeId);
  if (!edge) return null;
  return { edge, evidence: index.evidenceByEdgeId.get(edgeId) ?? [] };
}

export function findEdgeEvidence(
  graph: SoftwareGraph,
  edgeId: string | null,
): { edge: SoftwareGraphEdge; evidence: SoftwareGraph["evidence"] } | null {
  return getEdgeEvidenceFromIndex(buildDependenciesGraphIndex(graph), edgeId);
}

export interface DependencyKindCount {
  kind: DependencyEdgeKind;
  count: number;
}

export function countDependencyEdgesByKind(graph: SoftwareGraph): DependencyKindCount[] {
  const graphEdges = Array.isArray(graph.edges) ? graph.edges : [];
  const counts = new Map<DependencyEdgeKind, number>();

  for (const kind of DEPENDENCY_EDGE_KINDS) {
    counts.set(kind, 0);
  }

  for (const edge of graphEdges) {
    const mapped = resolveDependencyKindFromGraphEdge(edge.kind);
    if (mapped) {
      counts.set(mapped, (counts.get(mapped) ?? 0) + 1);
    }
  }

  return DEPENDENCY_EDGE_KINDS.map((kind) => ({
    kind,
    count: counts.get(kind) ?? 0,
  })).filter(({ count }) => count > 0);
}

export function filterDependenciesProjection(
  projection: DependenciesProjection,
  searchQuery: string,
  graph: SoftwareGraph,
): DependenciesProjection {
  const query = searchQuery.trim().toLowerCase();
  if (!query) return projection;

  const rawLabelById = new Map(graph.nodes.map((node) => [node.id, node.label]));

  const matchingNodeIds = new Set(
    projection.nodes
      .filter((node) => {
        const rawLabel = rawLabelById.get(node.id) ?? node.label;
        return rawLabel.toLowerCase().includes(query) || node.id.toLowerCase().includes(query);
      })
      .map((node) => node.id),
  );

  if (matchingNodeIds.size === 0) {
    return { nodes: [], edges: [], orphanNodeIds: [] };
  }

  const edges = projection.edges.filter(
    (edge) => matchingNodeIds.has(edge.source) || matchingNodeIds.has(edge.target),
  );
  const visibleNodeIds = new Set(matchingNodeIds);
  for (const edge of edges) {
    visibleNodeIds.add(edge.source);
    visibleNodeIds.add(edge.target);
  }

  const nodes = projection.nodes.filter((node) => visibleNodeIds.has(node.id));
  const orphanNodeIds = projection.orphanNodeIds.filter((id) => visibleNodeIds.has(id));

  return { nodes, edges, orphanNodeIds };
}
