/**
 * Atlas projection: SoftwareGraph -> SemanticSystemModel -> readable system overview.
 * Routes/files never become default Atlas districts; raw graph nodes stay available
 * through semantic memberships and the existing inspector drill-down.
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
  groups: SoftwareGraphGroup[];
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

function representativeGraphNodeId(entity: SemanticEntity, graphNodeIds: ReadonlySet<string>): string | null {
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

function selectEntities(model: SemanticSystemModel, searchQuery: string): {
  entities: SemanticEntity[];
  condensed: boolean;
  total: number;
} {
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const searchable = model.entities.filter((entity) => PRIMARY_SEARCH_KINDS.has(entity.kind));
  if (normalizedSearch) {
    const matches = searchable.filter((entity) => entity.label.toLowerCase().includes(normalizedSearch));
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

function buildGroups(
  model: SemanticSystemModel,
  representativeByEntityId: ReadonlyMap<string, string>,
): SoftwareGraphGroup[] {
  const membershipsByEntityId = new Map<string, Set<string>>();
  for (const membership of model.memberships) {
    const ids = membershipsByEntityId.get(membership.semanticEntityId) ?? new Set<string>();
    ids.add(membership.graphNodeId);
    membershipsByEntityId.set(membership.semanticEntityId, ids);
  }

  return model.entities
    .filter((entity) => entity.kind === "business-domain")
    .map((entity): SoftwareGraphGroup => {
      const nodeIds = membershipsByEntityId.get(entity.id) ?? new Set<string>();
      const representativeId = representativeByEntityId.get(entity.id);
      if (representativeId) nodeIds.add(representativeId);
      return {
        id: `atlas-domain:${entity.id}`,
        kind: "domain",
        label: entity.label,
        nodeIds: [...nodeIds].sort(),
      };
    })
    .filter((group) => group.nodeIds.length > 0)
    .sort((left, right) => left.label.localeCompare(right.label));
}

export function projectAtlasGraph(
  graph: SoftwareGraph,
  options: AtlasProjectionOptions = {},
): AtlasProjection {
  const model = buildSemanticSystemModel(graph);
  const graphNodeIds = new Set(graph.nodes.map((node) => node.id));
  const representativeByEntityId = new Map<string, string>();
  for (const entity of model.entities) {
    const representativeId = representativeGraphNodeId(entity, graphNodeIds);
    if (representativeId) representativeByEntityId.set(entity.id, representativeId);
  }

  const selection = selectEntities(model, options.searchQuery ?? "");
  const selectedByRepresentative = new Map<string, SemanticEntity>();
  for (const entity of selection.entities) {
    const representativeId = representativeByEntityId.get(entity.id);
    if (!representativeId) continue;
    const existing = selectedByRepresentative.get(representativeId);
    if (!existing || entity.kind === "business-domain") {
      selectedByRepresentative.set(representativeId, entity);
    }
  }
  const selected = [...selectedByRepresentative.entries()];
  const visibleIds = new Set(selected.map(([id]) => id));
  const visibleSemanticIds = new Set(selected.map(([, entity]) => entity.id));

  const nodes: GraphCanvasNode[] = selected.map(([id, entity]) => {
    const kind = GRAPH_KIND_BY_SEMANTIC_KIND[entity.kind];
    return {
      id,
      label: truncateLabel(entity.label),
      kind,
      color: getNodeKindColor(kind),
    };
  });

  const edges: GraphCanvasEdge[] = model.relations
    .filter(
      (relation) =>
        visibleSemanticIds.has(relation.sourceId) && visibleSemanticIds.has(relation.targetId),
    )
    .map((relation): GraphCanvasEdge | null => {
      const source = representativeByEntityId.get(relation.sourceId);
      const target = representativeByEntityId.get(relation.targetId);
      if (!source || !target || source === target || !visibleIds.has(source) || !visibleIds.has(target)) {
        return null;
      }
      const kind = GRAPH_EDGE_KIND_BY_SEMANTIC_KIND[relation.kind];
      const weight = relation.metadata.weight;
      return {
        id: relation.id,
        source,
        target,
        kind,
        label: typeof weight === "number" && weight > 1 ? `${relation.kind} ×${weight}` : relation.kind,
      };
    })
    .filter((edge): edge is GraphCanvasEdge => edge !== null)
    .slice(0, ATLAS_MAX_EDGES);

  const groups = buildGroups(model, representativeByEntityId).filter((group) =>
    group.nodeIds.some((nodeId) => visibleIds.has(nodeId)),
  );

  return {
    nodes,
    edges,
    groups,
    condensed: graph.condensed || selection.condensed || edges.length >= ATLAS_MAX_EDGES,
    totalNodes: selection.total,
    visibleNodes: nodes.length,
  };
}
