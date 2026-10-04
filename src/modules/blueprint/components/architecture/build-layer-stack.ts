/**
 * Builds stack cards from contains-edges and groups them by SemanticSystemModel
 * business domains (PR-07). No UI-side domain classification — semantic authority only.
 */

import type {
  SemanticEntityKind,
  SemanticSystemModel,
} from "../../../../../shared/semantic-system-model.types.js";
import type { SoftwareGraph, SoftwareGraphNode, SoftwareGraphNodeKind } from "../../types";
import { resolveLayerType, type ArchitectureLayerType } from "./architecture-layer-accents.js";

export interface ArchitectureStackCard {
  id: string;
  label: string;
  kind: SoftwareGraphNodeKind;
  layerType: ArchitectureLayerType | "unknown";
  domainTag: string | null;
  services: string[];
  filePath: string | null;
}

const CANONICAL_LAYER_ORDER = [
  "experience layer",
  "application layer",
  "domain layer",
  "integration layer",
  "persistence layer",
  "processing layer",
  "platform layer",
];

function layerSortIndex(label: string): number {
  const normalized = label.trim().toLowerCase();
  const index = CANONICAL_LAYER_ORDER.indexOf(normalized);
  return index >= 0 ? index : CANONICAL_LAYER_ORDER.length;
}

export function buildArchitectureStackCards(
  graph: SoftwareGraph,
  stackKind: SoftwareGraphNodeKind,
): ArchitectureStackCard[] {
  const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
  const edges = Array.isArray(graph.edges) ? graph.edges : [];
  const nodeById = new Map(nodes.map((node) => [node.id, node]));

  const childrenByParentId = new Map<string, string[]>();
  const parentByChildId = new Map<string, string>();
  for (const edge of edges) {
    if (edge.kind !== "contains") continue;
    const siblings = childrenByParentId.get(edge.sourceId);
    if (siblings) siblings.push(edge.targetId);
    else childrenByParentId.set(edge.sourceId, [edge.targetId]);
    parentByChildId.set(edge.targetId, edge.sourceId);
  }

  return nodes
    .filter((node) => node.kind === stackKind)
    .map((node) => {
      const childIds = childrenByParentId.get(node.id) ?? [];
      const services = childIds
        .map((childId) => nodeById.get(childId))
        .filter((child): child is SoftwareGraphNode => child != null)
        .map((child) => child.label);

      const parentId = parentByChildId.get(node.id);
      const parent = parentId ? nodeById.get(parentId) : undefined;
      const domainTag =
        parent?.kind === "domain" ? parent.label : parent?.kind === "layer" ? parent.label : null;
      const filePath = typeof node.metadata?.filePath === "string" ? node.metadata.filePath : null;

      return {
        id: node.id,
        label: node.label,
        kind: node.kind,
        layerType: node.kind === "layer" ? resolveLayerType(node.label) : "unknown",
        domainTag,
        services,
        filePath,
      };
    })
    .sort((left, right) => {
      if (stackKind === "layer") {
        const byLayer = layerSortIndex(left.label) - layerSortIndex(right.label);
        if (byLayer !== 0) return byLayer;
      }
      return left.label.localeCompare(right.label);
    });
}

const UNASSIGNED_DOMAIN_KEY = "unassigned";

export const UNASSIGNED_DOMAIN_LABEL = "Ohne Domäne";

export const NO_DOMAINS_FOUND_TEXT =
  "Keine fachlichen Domänen erkannt — technische Ordner/Layer bleiben unter Ohne Domäne.";

export const UNKNOWN_LAYER_LABEL = "Unbekannt";

export interface ArchitectureDomainGroup {
  id: string;
  label: string;
  isUnassigned: boolean;
  /** Semantic kind for the district (business-domain / capability / unassigned). */
  semanticKind: "business-domain" | "capability" | "unassigned";
  cards: ArchitectureStackCard[];
}

export interface ArchitectureSemanticKindSummary {
  kind: SemanticEntityKind;
  label: string;
  count: number;
}

const KIND_SUMMARY_LABELS: Partial<Record<SemanticEntityKind, string>> = {
  application: "Anwendung",
  "business-domain": "Fachdomäne",
  capability: "Capability",
  service: "Service",
  "technical-module": "Technisches Modul",
  resource: "Ressource",
  "data-store": "Datenspeicher",
  endpoint: "Endpoint",
  "external-system": "Externes System",
  "security-control": "Security Control",
};

const KIND_SUMMARY_ORDER: readonly SemanticEntityKind[] = [
  "application",
  "business-domain",
  "capability",
  "service",
  "technical-module",
  "resource",
  "data-store",
  "endpoint",
  "external-system",
  "security-control",
];

export function summarizeArchitectureSemanticKinds(
  semantic: SemanticSystemModel | null | undefined,
): ArchitectureSemanticKindSummary[] {
  if (!semantic) return [];
  const counts = new Map<SemanticEntityKind, number>();
  for (const entity of semantic.entities) {
    counts.set(entity.kind, (counts.get(entity.kind) ?? 0) + 1);
  }
  return KIND_SUMMARY_ORDER.filter((kind) => (counts.get(kind) ?? 0) > 0).map((kind) => ({
    kind,
    label: KIND_SUMMARY_LABELS[kind] ?? kind,
    count: counts.get(kind) ?? 0,
  }));
}

function collectDescendantGraphNodeIds(
  rootId: string,
  childrenByParentId: Map<string, string[]>,
): string[] {
  const out: string[] = [];
  const stack = [rootId];
  const seen = new Set<string>();
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || seen.has(current)) continue;
    seen.add(current);
    out.push(current);
    const children = childrenByParentId.get(current);
    if (children) {
      for (const childId of children) stack.push(childId);
    }
  }
  return out;
}

function buildContainsIndex(graph: SoftwareGraph): {
  nodeById: Map<string, SoftwareGraphNode>;
  parentByChildId: Map<string, string>;
  childrenByParentId: Map<string, string[]>;
} {
  const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
  const edges = Array.isArray(graph.edges) ? graph.edges : [];
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const parentByChildId = new Map<string, string>();
  const childrenByParentId = new Map<string, string[]>();
  for (const edge of edges) {
    if (edge.kind !== "contains") continue;
    parentByChildId.set(edge.targetId, edge.sourceId);
    const siblings = childrenByParentId.get(edge.sourceId);
    if (siblings) siblings.push(edge.targetId);
    else childrenByParentId.set(edge.sourceId, [edge.targetId]);
  }
  return { nodeById, parentByChildId, childrenByParentId };
}

function finalizeDomainGroups(
  groups: Map<string, ArchitectureDomainGroup>,
): ArchitectureDomainGroup[] {
  return [...groups.values()].sort((left, right) => {
    if (left.isUnassigned !== right.isUnassigned) return left.isUnassigned ? 1 : -1;
    return left.label.localeCompare(right.label);
  });
}

function pushCardIntoDomainGroup(
  groups: Map<string, ArchitectureDomainGroup>,
  card: ArchitectureStackCard,
  domainId: string | null,
  domainLabel: string | null,
): void {
  const isUnassigned = domainId == null || domainLabel == null;
  const id = isUnassigned ? UNASSIGNED_DOMAIN_KEY : domainId;
  const existing = groups.get(id);
  if (existing) {
    existing.cards.push(card);
    return;
  }
  groups.set(id, {
    id,
    label: isUnassigned ? UNASSIGNED_DOMAIN_LABEL : domainLabel,
    isUnassigned,
    semanticKind: isUnassigned ? "unassigned" : "business-domain",
    cards: [card],
  });
}

function allCardsUnassigned(cards: ArchitectureStackCard[]): ArchitectureDomainGroup[] {
  if (cards.length === 0) return [];
  return [
    {
      id: UNASSIGNED_DOMAIN_KEY,
      label: UNASSIGNED_DOMAIN_LABEL,
      isUnassigned: true,
      semanticKind: "unassigned",
      cards: [...cards],
    },
  ];
}

/**
 * Primary projection: BusinessDomains / Capabilities from SemanticSystemModel only.
 * Does not invent domains from folder names or metadata heuristics.
 */
export function groupArchitectureCardsBySemanticDomains(
  graph: SoftwareGraph,
  cards: ArchitectureStackCard[],
  semantic: SemanticSystemModel | null | undefined,
): ArchitectureDomainGroup[] {
  if (!semantic || semantic.entities.length === 0) {
    return allCardsUnassigned(cards);
  }

  const businessDomains = semantic.entities.filter((entity) => entity.kind === "business-domain");
  const capabilities = semantic.entities.filter((entity) => entity.kind === "capability");
  const districtEntities =
    businessDomains.length > 0 ? businessDomains : capabilities.length > 0 ? capabilities : [];

  if (districtEntities.length === 0) {
    return allCardsUnassigned(cards);
  }

  const districtById = new Map(districtEntities.map((entity) => [entity.id, entity]));
  const districtIdByGraphNodeId = new Map<string, string>();
  for (const membership of semantic.memberships) {
    if (!districtById.has(membership.semanticEntityId)) continue;
    const current = districtIdByGraphNodeId.get(membership.graphNodeId);
    if (!current || membership.semanticEntityId.localeCompare(current) < 0) {
      districtIdByGraphNodeId.set(membership.graphNodeId, membership.semanticEntityId);
    }
  }

  const { childrenByParentId } = buildContainsIndex(graph);
  const groups = new Map<string, ArchitectureDomainGroup>();

  for (const card of cards) {
    const candidateNodeIds = collectDescendantGraphNodeIds(card.id, childrenByParentId);
    let matchedId: string | null = null;
    for (const graphNodeId of candidateNodeIds) {
      const districtId = districtIdByGraphNodeId.get(graphNodeId);
      if (districtId) {
        matchedId = districtId;
        break;
      }
    }
    if (!matchedId) {
      matchedId = districtIdByGraphNodeId.get(card.id) ?? null;
    }

    const district = matchedId ? districtById.get(matchedId) : undefined;
    if (!district) {
      pushCardIntoDomainGroup(groups, card, null, null);
      continue;
    }
    const isCapability = district.kind === "capability";
    const existing = groups.get(district.id);
    if (existing) {
      existing.cards.push(card);
      continue;
    }
    groups.set(district.id, {
      id: district.id,
      label: district.label,
      isUnassigned: false,
      semanticKind: isCapability ? "capability" : "business-domain",
      cards: [card],
    });
  }

  return finalizeDomainGroups(groups);
}

/**
 * @deprecated PR-07 — folder/metadata domain inference removed from Architecture product path.
 * Kept for unit tests of the unassigned-only fallback shape.
 */
export function groupArchitectureCardsByDomain(
  _graph: SoftwareGraph,
  cards: ArchitectureStackCard[],
): ArchitectureDomainGroup[] {
  return allCardsUnassigned(cards);
}

export function hasRecognizedArchitectureDomains(groups: ArchitectureDomainGroup[]): boolean {
  return groups.some((group) => !group.isUnassigned);
}
