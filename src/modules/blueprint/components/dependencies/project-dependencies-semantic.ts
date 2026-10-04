/**
 * RVP-7 semantic Dependencies projection — BusinessDomains/Services/Components
 * with aggregated edges, density cap, and drill-down to file-level.
 * Location: src/modules/blueprint/components/dependencies/project-dependencies-semantic.ts
 */

import { buildSemanticSystemModel } from "../../../../../shared/semantic-system-model.js";
import type { SemanticSystemModel } from "../../../../../shared/semantic-system-model.types.js";
import type {
  GraphCanvasEdge,
  GraphCanvasNode,
  SoftwareGraph,
  SoftwareGraphEdge,
  SoftwareGraphNode,
} from "../../types";
import {
  CROSS_CUTTING_EDGE_KINDS,
  DEFAULT_VISIBLE_DEPENDENCY_KINDS,
  PRIMARY_TOPOLOGY_EDGE_KINDS,
  RELATIONSHIP_LABELS,
  resolveDependencyKindFromGraphEdge,
  type DependencyEdgeKind,
} from "./_projection.constants.js";

const PRIMARY_KIND_SET = new Set<DependencyEdgeKind>(PRIMARY_TOPOLOGY_EDGE_KINDS);
const CROSS_CUTTING_KIND_SET = new Set<DependencyEdgeKind>(CROSS_CUTTING_EDGE_KINDS);
import {
  projectDependenciesGraph,
  type DependenciesProjection,
  type DependenciesProjectionOptions,
} from "./_projection.js";

/** Hard display cap for the default semantic overview (not fabricated analysis). */
export const DEPENDENCIES_SEMANTIC_MAX_NODES = 80;

const OVERVIEW_KINDS = new Set([
  "business-domain",
  "service",
  "technical-module",
  "component",
  "data-store",
]);

export type DependenciesViewLevel = "semantic" | "files";

export interface SemanticDependenciesOptions extends DependenciesProjectionOptions {
  level?: DependenciesViewLevel;
  /** When drilling into files, restrict to members of this semantic entity. */
  focusSemanticEntityId?: string | null;
  semanticModel?: SemanticSystemModel | null;
}

interface AggregateEdge {
  source: string;
  target: string;
  kinds: Set<DependencyEdgeKind>;
  weight: number;
  evidenceEdgeIds: string[];
}

function preferredSemanticEntityId(
  graphNodeId: string,
  semantic: SemanticSystemModel,
): string | null {
  const entityById = new Map(semantic.entities.map((entity) => [entity.id, entity]));
  let best: { id: string; rank: number } | null = null;
  for (const membership of semantic.memberships) {
    if (membership.graphNodeId !== graphNodeId) continue;
    const entity = entityById.get(membership.semanticEntityId);
    if (!entity || !OVERVIEW_KINDS.has(entity.kind)) continue;
    const rank =
      entity.kind === "business-domain"
        ? 3
        : entity.kind === "service"
          ? 2
          : entity.kind === "technical-module" || entity.kind === "component"
            ? 1
            : 0;
    if (!best || rank > best.rank || (rank === best.rank && entity.id.localeCompare(best.id) < 0)) {
      best = { id: entity.id, rank };
    }
  }
  return best?.id ?? null;
}

function mapGraphNodeToSemanticId(
  node: SoftwareGraphNode,
  semantic: SemanticSystemModel,
): string | null {
  return preferredSemanticEntityId(node.id, semantic);
}

function truncateLabel(label: string, max = 48): string {
  const trimmed = label.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

function resolveOrphanColor(): string {
  return "var(--color-muted-foreground)";
}

function buildSemanticOverview(
  graph: SoftwareGraph,
  semantic: SemanticSystemModel,
  visibleKinds: Set<DependencyEdgeKind>,
): DependenciesProjection {
  const graphNodes = Array.isArray(graph.nodes) ? graph.nodes : [];
  const graphEdges = Array.isArray(graph.edges) ? graph.edges : [];

  const nodeToSemantic = new Map<string, string>();
  for (const node of graphNodes) {
    const semanticId = mapGraphNodeToSemanticId(node, semantic);
    if (semanticId) nodeToSemantic.set(node.id, semanticId);
  }

  const aggregates = new Map<string, AggregateEdge>();
  for (const edge of graphEdges) {
    const kind = resolveDependencyKindFromGraphEdge(edge.kind);
    if (!kind || !visibleKinds.has(kind)) continue;
    const sourceId = nodeToSemantic.get(edge.sourceId);
    const targetId = nodeToSemantic.get(edge.targetId);
    if (!sourceId || !targetId || sourceId === targetId) continue;
    const key = `${sourceId}->${targetId}`;
    const current = aggregates.get(key);
    if (current) {
      current.kinds.add(kind);
      current.weight += 1;
      // Keep full evidence backlinks for drill-down (density caps nodes, not evidence).
      current.evidenceEdgeIds.push(edge.id);
      continue;
    }
    aggregates.set(key, {
      source: sourceId,
      target: targetId,
      kinds: new Set([kind]),
      weight: 1,
      evidenceEdgeIds: [edge.id],
    });
  }

  const connected = new Set<string>();
  for (const aggregate of aggregates.values()) {
    connected.add(aggregate.source);
    connected.add(aggregate.target);
  }

  const overviewEntities = semantic.entities
    .filter((entity) => OVERVIEW_KINDS.has(entity.kind))
    .sort((left, right) => left.id.localeCompare(right.id));

  const orphanNodeIds: string[] = [];
  const nodes: GraphCanvasNode[] = [];
  for (const entity of overviewEntities) {
    const isOrphan = !connected.has(entity.id);
    if (isOrphan) orphanNodeIds.push(entity.id);
    nodes.push({
      id: entity.id,
      label: truncateLabel(entity.label),
      kind: entity.kind === "business-domain" ? "domain" : "service",
      color: isOrphan ? resolveOrphanColor() : undefined,
    });
  }

  // Density cap: prefer primary-topology degree, then total degree, then orphans.
  const primaryDegree = new Map<string, number>();
  const anyDegree = new Map<string, number>();
  for (const aggregate of aggregates.values()) {
    const hasPrimary = [...aggregate.kinds].some((kind) => PRIMARY_KIND_SET.has(kind));
    const hasCrossCuttingOnly =
      !hasPrimary && [...aggregate.kinds].every((kind) => CROSS_CUTTING_KIND_SET.has(kind));
    const bump = (map: Map<string, number>, id: string, amount: number) => {
      map.set(id, (map.get(id) ?? 0) + amount);
    };
    bump(anyDegree, aggregate.source, aggregate.weight);
    bump(anyDegree, aggregate.target, aggregate.weight);
    if (hasPrimary) {
      bump(primaryDegree, aggregate.source, aggregate.weight);
      bump(primaryDegree, aggregate.target, aggregate.weight);
    } else if (!hasCrossCuttingOnly) {
      bump(primaryDegree, aggregate.source, aggregate.weight);
      bump(primaryDegree, aggregate.target, aggregate.weight);
    }
  }

  const ranked = [...nodes]
    .sort((left, right) => {
      const leftPrimary = primaryDegree.get(left.id) ?? 0;
      const rightPrimary = primaryDegree.get(right.id) ?? 0;
      if (rightPrimary !== leftPrimary) return rightPrimary - leftPrimary;
      const leftAny = anyDegree.get(left.id) ?? 0;
      const rightAny = anyDegree.get(right.id) ?? 0;
      if (rightAny !== leftAny) return rightAny - leftAny;
      return left.id.localeCompare(right.id);
    })
    .slice(0, DEPENDENCIES_SEMANTIC_MAX_NODES);
  const visibleIds = new Set(ranked.map((node) => node.id));
  const cappedOrphans = orphanNodeIds.filter((id) => visibleIds.has(id));

  const underlyingEdgeIdsByEdgeId = new Map<string, readonly string[]>();
  const edges: GraphCanvasEdge[] = [];
  for (const aggregate of aggregates.values()) {
    if (!visibleIds.has(aggregate.source) || !visibleIds.has(aggregate.target)) continue;
    const kinds = [...aggregate.kinds].sort();
    const typeLabel = kinds.map((kind) => RELATIONSHIP_LABELS[kind]).join("+");
    const label = aggregate.weight > 1 ? `${typeLabel} ×${aggregate.weight}` : typeLabel;
    const edgeId = `semantic-dep:${aggregate.source}:${aggregate.target}`;
    underlyingEdgeIdsByEdgeId.set(edgeId, [...aggregate.evidenceEdgeIds]);
    edges.push({
      id: edgeId,
      source: aggregate.source,
      target: aggregate.target,
      kind: kinds[0]!,
      label,
    });
  }

  return {
    nodes: ranked,
    edges,
    orphanNodeIds: cappedOrphans,
    underlyingEdgeIdsByEdgeId,
  };
}

function buildFileLevelProjection(
  graph: SoftwareGraph,
  semantic: SemanticSystemModel,
  visibleKinds: Set<DependencyEdgeKind>,
  focusSemanticEntityId: string,
): DependenciesProjection {
  const memberIds = new Set(
    semantic.memberships
      .filter((membership) => membership.semanticEntityId === focusSemanticEntityId)
      .map((membership) => membership.graphNodeId),
  );

  const graphNodes = Array.isArray(graph.nodes) ? graph.nodes : [];
  const graphEdges = Array.isArray(graph.edges) ? graph.edges : [];

  for (const node of graphNodes) {
    if (preferredSemanticEntityId(node.id, semantic) === focusSemanticEntityId) {
      memberIds.add(node.id);
    }
  }

  // Progressive disclosure: when the entity is thin (e.g. a single service node),
  // include 1-hop dependency neighbors so drill-down is still a readable file graph.
  if (memberIds.size > 0 && memberIds.size <= 3) {
    for (const edge of graphEdges) {
      const kind = resolveDependencyKindFromGraphEdge(edge.kind);
      if (!kind || !visibleKinds.has(kind)) continue;
      if (memberIds.has(edge.sourceId)) memberIds.add(edge.targetId);
      if (memberIds.has(edge.targetId)) memberIds.add(edge.sourceId);
    }
  }

  if (memberIds.size === 0) {
    return { nodes: [], edges: [], orphanNodeIds: [] };
  }

  const nodeById = new Map(graphNodes.map((node) => [node.id, node]));

  const dependencyEdges = graphEdges.filter((edge) => {
    const kind = resolveDependencyKindFromGraphEdge(edge.kind);
    if (!kind || !visibleKinds.has(kind)) return false;
    return memberIds.has(edge.sourceId) || memberIds.has(edge.targetId);
  });

  const connected = new Set<string>();
  for (const edge of dependencyEdges) {
    if (memberIds.has(edge.sourceId)) connected.add(edge.sourceId);
    if (memberIds.has(edge.targetId)) connected.add(edge.targetId);
  }

  const orphanNodeIds: string[] = [];
  const nodes: GraphCanvasNode[] = [];
  for (const nodeId of memberIds) {
    const node = nodeById.get(nodeId);
    if (!node) continue;
    const isOrphan = !connected.has(node.id);
    if (isOrphan) orphanNodeIds.push(node.id);
    nodes.push({
      id: node.id,
      label: truncateLabel(node.label),
      kind: node.kind,
      color: isOrphan ? resolveOrphanColor() : undefined,
    });
  }

  const visibleIds = new Set(nodes.map((node) => node.id));
  const edges = dependencyEdges
    .filter((edge) => visibleIds.has(edge.sourceId) && visibleIds.has(edge.targetId))
    .map(
      (edge: SoftwareGraphEdge): GraphCanvasEdge => ({
        id: edge.id,
        source: edge.sourceId,
        target: edge.targetId,
        kind: resolveDependencyKindFromGraphEdge(edge.kind) ?? edge.kind,
        label: (() => {
          const kind = resolveDependencyKindFromGraphEdge(edge.kind);
          return kind ? RELATIONSHIP_LABELS[kind] : edge.kind;
        })(),
      }),
    );

  return { nodes, edges, orphanNodeIds };
}

export function projectDependenciesSemanticGraph(
  graph: SoftwareGraph,
  options: SemanticDependenciesOptions = {},
): DependenciesProjection {
  const semantic = options.semanticModel ?? buildSemanticSystemModel(graph);
  const visibleKinds =
    options.visibleEdgeKinds === undefined
      ? new Set(DEFAULT_VISIBLE_DEPENDENCY_KINDS)
      : new Set(options.visibleEdgeKinds);

  const level = options.level ?? "semantic";
  if (level === "files" && options.focusSemanticEntityId) {
    return buildFileLevelProjection(graph, semantic, visibleKinds, options.focusSemanticEntityId);
  }

  const overviewEntities = semantic.entities.filter((entity) => OVERVIEW_KINDS.has(entity.kind));
  if (overviewEntities.length === 0) {
    // Honest capped fallback when no semantic entities exist yet.
    const raw = projectDependenciesGraph(graph, { visibleEdgeKinds: visibleKinds });
    const cappedNodes = raw.nodes.slice(0, DEPENDENCIES_SEMANTIC_MAX_NODES);
    const visibleIds = new Set(cappedNodes.map((node) => node.id));
    return {
      nodes: cappedNodes,
      edges: raw.edges.filter((edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target)),
      orphanNodeIds: raw.orphanNodeIds.filter((id) => visibleIds.has(id)),
    };
  }

  return buildSemanticOverview(graph, semantic, visibleKinds);
}

/** Prefer a file-bearing member for inspector deep-links (open-in-editor). */
export function resolveSemanticRepresentativeNode(
  semanticEntityId: string,
  graph: SoftwareGraph,
  semantic: SemanticSystemModel,
): SoftwareGraphNode | null {
  const nodeById = new Map(
    (Array.isArray(graph.nodes) ? graph.nodes : []).map((node) => [node.id, node]),
  );
  const memberIds = semantic.memberships
    .filter((membership) => membership.semanticEntityId === semanticEntityId)
    .map((membership) => membership.graphNodeId);

  for (const id of memberIds) {
    const node = nodeById.get(id);
    if (node?.filePath) return node;
  }
  for (const id of memberIds) {
    const node = nodeById.get(id);
    if (node) return node;
  }

  const entity = semantic.entities.find((item) => item.id === semanticEntityId);
  const sourceId =
    entity && typeof entity.metadata?.sourceGraphNodeId === "string"
      ? entity.metadata.sourceGraphNodeId
      : null;
  if (sourceId) return nodeById.get(sourceId) ?? null;
  return null;
}
