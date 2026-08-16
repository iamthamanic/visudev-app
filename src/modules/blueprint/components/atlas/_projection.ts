/**
 * Atlas projection: SoftwareGraph -> SemanticSystemModel -> readable system overview.
 * Semantic entity IDs are the projected identities. Raw graph nodes remain evidence
 * targets for the inspector and never masquerade as semantic nodes.
 */

import { buildSemanticSystemModel } from "../../../../../shared/semantic-system-model.js";
import type {
  SemanticEntity,
  SemanticEntityKind,
  SemanticRelationKind,
  SemanticSystemModel,
} from "../../../../../shared/semantic-system-model.types.js";
import { getNodeKindColor } from "../infrastructure/_colors.js";
import type {
  GraphCanvasEdge,
  GraphCanvasNode,
  SoftwareGraph,
  SoftwareGraphEdgeKind,
  SoftwareGraphGroup,
  SoftwareGraphNodeKind,
} from "../../types";
import {
  ATLAS_MAX_EDGES,
  ATLAS_MAX_LABEL_LEN,
  ATLAS_SEARCH_MATCH_LIMIT,
  ATLAS_SEMANTIC_LIMIT,
} from "./_projection.constants.js";

export interface AtlasProjectionOptions {
  searchQuery?: string;
}

export interface AtlasProjection {
  nodes: GraphCanvasNode[];
  edges: GraphCanvasEdge[];
  /** Groups whose nodeIds reference projected semantic node IDs. */
  groups: SoftwareGraphGroup[];
  /** Same groups with raw graph memberships for evidence drill-down. */
  inspectorGroups: SoftwareGraphGroup[];
  semanticEntities: SemanticEntity[];
  sourceGraphNodeIdBySemanticId: Record<string, string>;
  condensed: boolean;
  totalNodes: number;
  visibleNodes: number;
}

const PRIMARY_SEARCH_KINDS = new Set<SemanticEntityKind>([
  "application",
  "business-domain",
  "service",
  "component",
  "data-store",
  "external-system",
]);

const GRAPH_KIND_BY_SEMANTIC_KIND: Record<SemanticEntityKind, SoftwareGraphNodeKind> = {
  application: "application",
  "business-domain": "domain",
  service: "service",
  component: "module",
  "data-store": "table",
  "external-system": "external",
  "use-case": "module",
  "deployment-unit": "runtime",
  "execution-flow": "module",
};

const GRAPH_EDGE_KIND_BY_SEMANTIC_KIND: Record<SemanticRelationKind, SoftwareGraphEdgeKind> = {
  contains: "contains",
  "depends-on": "references",
  calls: "calls",
  "accesses-data": "data",
  "communicates-with": "api",
  authenticates: "authenticates",
  validates: "validates",
};

function truncateLabel(label: string): string {
  const trimmed = label.trim();
  if (trimmed.length <= ATLAS_MAX_LABEL_LEN) return trimmed;
  return `${trimmed.slice(0, ATLAS_MAX_LABEL_LEN - 1)}…`;
}

function representativeGraphNodeId(
  entity: SemanticEntity,
  graphNodeIds: ReadonlySet<string>,
): string | null {
  const direct = entity.metadata.sourceGraphNodeId;
  if (typeof direct === "string" && graphNodeIds.has(direct)) return direct;
  for (const evidence of entity.evidence) {
    if (evidence.source === "graph-node" && graphNodeIds.has(evidence.refId)) return evidence.refId;
  }
  return null;
}

function defaultEntities(model: SemanticSystemModel): SemanticEntity[] {
  const applications = model.entities.filter((entity) => entity.kind === "application");
  const domains = model.entities.filter((entity) => entity.kind === "business-domain");
  if (domains.length > 0) return [...applications, ...domains];
  return [
    ...applications,
    ...model.entities.filter((entity) =>
      ["service", "component", "data-store", "external-system"].includes(entity.kind),
    ),
  ];
}

function selectEntities(
  model: SemanticSystemModel,
  searchQuery: string,
): { entities: SemanticEntity[]; condensed: boolean; total: number } {
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const searchable = model.entities.filter((entity) => PRIMARY_SEARCH_KINDS.has(entity.kind));
  if (normalizedSearch) {
    const matches = searchable.filter((entity) =>
      entity.label.toLowerCase().includes(normalizedSearch),
    );
    return {
      entities: matches.slice(0, ATLAS_SEARCH_MATCH_LIMIT),
      condensed: matches.length > ATLAS_SEARCH_MATCH_LIMIT,
      total: searchable.length,
    };
  }
  const overview = defaultEntities(model);
  return {
    entities: overview.slice(0, ATLAS_SEMANTIC_LIMIT),
    condensed: overview.length > ATLAS_SEMANTIC_LIMIT,
    total: overview.length,
  };
}

function membershipsByDomain(model: SemanticSystemModel): Map<string, Set<string>> {
  const entityById = new Map(model.entities.map((entity) => [entity.id, entity]));
  const result = new Map<string, Set<string>>();
  for (const membership of model.memberships) {
    if (entityById.get(membership.semanticEntityId)?.kind !== "business-domain") continue;
    const ids = result.get(membership.semanticEntityId) ?? new Set<string>();
    ids.add(membership.graphNodeId);
    result.set(membership.semanticEntityId, ids);
  }
  return result;
}

function buildGroups(
  model: SemanticSystemModel,
  selectedEntities: readonly SemanticEntity[],
  representativeByEntityId: ReadonlyMap<string, string>,
): { groups: SoftwareGraphGroup[]; inspectorGroups: SoftwareGraphGroup[] } {
  const rawMemberships = membershipsByDomain(model);
  const selectedById = new Set(selectedEntities.map((entity) => entity.id));
  const groups: SoftwareGraphGroup[] = [];
  const inspectorGroups: SoftwareGraphGroup[] = [];

  for (const domain of model.entities.filter((entity) => entity.kind === "business-domain")) {
    const rawIds = new Set(rawMemberships.get(domain.id) ?? []);
    const representativeId = representativeByEntityId.get(domain.id);
    if (representativeId) rawIds.add(representativeId);

    const semanticNodeIds = new Set<string>();
    if (selectedById.has(domain.id)) semanticNodeIds.add(domain.id);
    for (const entity of selectedEntities) {
      const rawRepresentative = representativeByEntityId.get(entity.id);
      if (rawRepresentative && rawIds.has(rawRepresentative)) semanticNodeIds.add(entity.id);
    }
    if (semanticNodeIds.size === 0) continue;

    const id = `atlas-domain:${domain.id}`;
    groups.push({
      id,
      kind: "domain",
      label: domain.label,
      nodeIds: [...semanticNodeIds].sort(),
    });
    inspectorGroups.push({
      id,
      kind: "domain",
      label: domain.label,
      nodeIds: [...rawIds].sort(),
    });
  }

  const byLabel = (left: SoftwareGraphGroup, right: SoftwareGraphGroup) =>
    left.label.localeCompare(right.label);
  return { groups: groups.sort(byLabel), inspectorGroups: inspectorGroups.sort(byLabel) };
}

function buildRepresentativeMap(
  graph: SoftwareGraph,
  model: SemanticSystemModel,
): Map<string, string> {
  const graphNodeIds = new Set(graph.nodes.map((node) => node.id));
  const result = new Map<string, string>();
  for (const entity of model.entities) {
    const representativeId = representativeGraphNodeId(entity, graphNodeIds);
    if (representativeId) result.set(entity.id, representativeId);
  }
  return result;
}

export function projectAtlasSemanticModel(
  graph: SoftwareGraph,
  model: SemanticSystemModel,
  options: AtlasProjectionOptions = {},
): AtlasProjection {
  const representativeByEntityId = buildRepresentativeMap(graph, model);
  const selection = selectEntities(model, options.searchQuery ?? "");
  const selectedEntities = selection.entities.filter((entity) =>
    representativeByEntityId.has(entity.id),
  );
  const visibleSemanticIds = new Set(selectedEntities.map((entity) => entity.id));

  const nodes: GraphCanvasNode[] = selectedEntities.map((entity) => {
    const kind = GRAPH_KIND_BY_SEMANTIC_KIND[entity.kind];
    return {
      id: entity.id,
      label: truncateLabel(entity.label),
      kind,
      color: getNodeKindColor(kind),
    };
  });

  const candidateEdges = model.relations
    .filter(
      (relation) =>
        visibleSemanticIds.has(relation.sourceId) && visibleSemanticIds.has(relation.targetId),
    )
    .map((relation): GraphCanvasEdge | null => {
      if (relation.sourceId === relation.targetId) return null;
      const kind = GRAPH_EDGE_KIND_BY_SEMANTIC_KIND[relation.kind];
      const weight = relation.metadata.weight;
      return {
        id: relation.id,
        source: relation.sourceId,
        target: relation.targetId,
        kind,
        label:
          typeof weight === "number" && weight > 1 ? `${relation.kind} ×${weight}` : relation.kind,
      };
    })
    .filter((edge): edge is GraphCanvasEdge => edge !== null);
  const edges = candidateEdges.slice(0, ATLAS_MAX_EDGES);
  const { groups, inspectorGroups } = buildGroups(
    model,
    selectedEntities,
    representativeByEntityId,
  );

  return {
    nodes,
    edges,
    groups,
    inspectorGroups,
    semanticEntities: selectedEntities,
    sourceGraphNodeIdBySemanticId: Object.fromEntries(representativeByEntityId.entries()),
    condensed: graph.condensed || selection.condensed || candidateEdges.length > ATLAS_MAX_EDGES,
    totalNodes: selection.total,
    visibleNodes: nodes.length,
  };
}

export function projectAtlasGraph(
  graph: SoftwareGraph,
  options: AtlasProjectionOptions = {},
): AtlasProjection {
  return projectAtlasSemanticModel(graph, buildSemanticSystemModel(graph), options);
}
