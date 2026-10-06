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
import { isStructuralDomainName } from "../../../../../shared/semantic-domain-inference.js";
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

/** Primary Atlas search/overview kinds — systemic first; resources via search only. */
const PRIMARY_SEARCH_KINDS = new Set<SemanticEntityKind>([
  "application",
  "business-domain",
  "capability",
  "service",
  "technical-module",
  "component",
  "data-store",
  "external-system",
  "security-control",
  "resource",
]);

const DEFAULT_OVERVIEW_KINDS = new Set<SemanticEntityKind>([
  "application",
  "business-domain",
  "capability",
  "service",
  "technical-module",
  "component",
  "data-store",
  "external-system",
  "security-control",
]);

const GRAPH_KIND_BY_SEMANTIC_KIND: Record<SemanticEntityKind, SoftwareGraphNodeKind> = {
  application: "application",
  "business-domain": "domain",
  capability: "module",
  resource: "symbol",
  service: "service",
  "technical-module": "module",
  endpoint: "route",
  "data-store": "table",
  "external-system": "external",
  "security-control": "service",
  "deployment-unit": "runtime",
  runtime: "runtime",
  "execution-flow": "module",
  component: "module",
  "use-case": "module",
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

const UUID_LABEL = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function truncateLabel(label: string): string {
  const trimmed = label.trim();
  if (trimmed.length <= ATLAS_MAX_LABEL_LEN) return trimmed;
  return `${trimmed.slice(0, ATLAS_MAX_LABEL_LEN - 1)}…`;
}

function isReadableOverviewEntity(entity: SemanticEntity): boolean {
  if (entity.kind !== "application") return true;
  return !UUID_LABEL.test(entity.label.trim());
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

const OVERVIEW_KIND_PRIORITY: readonly SemanticEntityKind[] = [
  "application",
  "business-domain",
  "capability",
  "technical-module",
  "service",
  "data-store",
  "external-system",
  "security-control",
  "component",
];

function defaultEntities(model: SemanticSystemModel): SemanticEntity[] {
  const applications = model.entities.filter(
    (entity) => entity.kind === "application" && isReadableOverviewEntity(entity),
  );
  const domains = model.entities.filter((entity) => entity.kind === "business-domain");
  const capabilities = model.entities.filter((entity) => entity.kind === "capability");
  // Primary districts: applications + business domains + capabilities (never resources as domains).
  if (domains.length > 0 || capabilities.length > 0) {
    return [...applications, ...domains, ...capabilities];
  }
  // No systemic domains — diversify technical overview; do not let one kind (e.g. security-control) flood the 40-cap.
  const byKind = new Map<SemanticEntityKind, SemanticEntity[]>();
  for (const entity of model.entities) {
    if (!DEFAULT_OVERVIEW_KINDS.has(entity.kind) || !isReadableOverviewEntity(entity)) continue;
    const bucket = byKind.get(entity.kind) ?? [];
    bucket.push(entity);
    byKind.set(entity.kind, bucket);
  }
  for (const bucket of byKind.values()) {
    bucket.sort((left, right) => left.id.localeCompare(right.id));
  }
  const picked: SemanticEntity[] = [...applications];
  const seen = new Set(picked.map((entity) => entity.id));
  let progress = true;
  while (picked.length < ATLAS_SEMANTIC_LIMIT && progress) {
    progress = false;
    for (const kind of OVERVIEW_KIND_PRIORITY) {
      if (picked.length >= ATLAS_SEMANTIC_LIMIT) break;
      const bucket = byKind.get(kind);
      if (!bucket || bucket.length === 0) continue;
      const next = bucket.shift();
      if (!next || seen.has(next.id)) continue;
      picked.push(next);
      seen.add(next.id);
      progress = true;
    }
  }
  return picked;
}

function selectEntities(
  model: SemanticSystemModel,
  searchQuery: string,
): { entities: SemanticEntity[]; condensed: boolean; total: number } {
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const searchable = model.entities.filter(
    (entity) => PRIMARY_SEARCH_KINDS.has(entity.kind) && isReadableOverviewEntity(entity),
  );
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
    if (isStructuralDomainName(domain.label)) continue;
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

  // v2: when no business-domain districts qualify, keep Atlas honest with
  // technical overview clusters (services / modules / stores / security) — never invent domains.
  if (groups.length === 0) {
    const technicalKinds = new Set([
      "application",
      "business-domain",
      "capability",
      "service",
      "technical-module",
      "component",
      "data-store",
      "external-system",
      "security-control",
    ]);
    for (const entity of selectedEntities) {
      if (!technicalKinds.has(entity.kind)) continue;
      if (isStructuralDomainName(entity.label)) continue;
      const representativeId = representativeByEntityId.get(entity.id);
      const id = `atlas-tech:${entity.id}`;
      groups.push({
        id,
        kind: "domain",
        label: entity.label,
        nodeIds: [entity.id],
      });
      inspectorGroups.push({
        id,
        kind: "domain",
        label: entity.label,
        nodeIds: representativeId ? [representativeId] : [entity.id],
      });
    }
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

function technicalOverviewEntities(
  model: SemanticSystemModel,
  representativeByEntityId: ReadonlyMap<string, string>,
): SemanticEntity[] {
  return model.entities
    .filter(
      (entity) =>
        DEFAULT_OVERVIEW_KINDS.has(entity.kind) &&
        isReadableOverviewEntity(entity) &&
        representativeByEntityId.has(entity.id),
    )
    .sort((left, right) => left.id.localeCompare(right.id))
    .slice(0, ATLAS_SEMANTIC_LIMIT);
}

export function projectAtlasSemanticModel(
  graph: SoftwareGraph,
  model: SemanticSystemModel,
  options: AtlasProjectionOptions = {},
): AtlasProjection {
  const representativeByEntityId = buildRepresentativeMap(graph, model);
  const searchQuery = options.searchQuery ?? "";
  const selection = selectEntities(model, searchQuery);
  let selectedEntities = selection.entities.filter((entity) =>
    representativeByEntityId.has(entity.id),
  );
  let { groups, inspectorGroups } = buildGroups(model, selectedEntities, representativeByEntityId);

  // Domains may exist without projectable representatives — widen to technical overview
  // so Atlas still shows honest districts (never invent business domains).
  let usedTechnicalFallback = false;
  if (groups.length === 0 && !searchQuery.trim()) {
    selectedEntities = technicalOverviewEntities(model, representativeByEntityId);
    ({ groups, inspectorGroups } = buildGroups(model, selectedEntities, representativeByEntityId));
    usedTechnicalFallback = true;
  }

  const visibleSemanticIds = new Set(selectedEntities.map((entity) => entity.id));

  const nodes: GraphCanvasNode[] = selectedEntities.map((entity) => {
    const kind = GRAPH_KIND_BY_SEMANTIC_KIND[entity.kind];
    return {
      id: entity.id,
      label: truncateLabel(entity.label),
      kind,
      color: getNodeKindColor(kind),
      semanticKind: entity.kind,
      knowledgeStatus: entity.knowledgeStatus,
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

  return {
    nodes,
    edges,
    groups,
    inspectorGroups,
    semanticEntities: selectedEntities,
    sourceGraphNodeIdBySemanticId: Object.fromEntries(representativeByEntityId.entries()),
    condensed:
      graph.condensed ||
      selection.condensed ||
      usedTechnicalFallback ||
      candidateEdges.length > ATLAS_MAX_EDGES,
    totalNodes: usedTechnicalFallback ? selectedEntities.length : selection.total,
    visibleNodes: nodes.length,
  };
}

export function projectAtlasGraph(
  graph: SoftwareGraph,
  options: AtlasProjectionOptions = {},
): AtlasProjection {
  return projectAtlasSemanticModel(graph, buildSemanticSystemModel(graph), options);
}
