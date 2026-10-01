/**
 * Builds stack cards from contains-edges and groups them by SemanticSystemModel
 * business domains (RVP-6), falling back to evidence-backed graph domains only.
 */

import { normalizeBusinessDomainCandidate } from "../../../../../shared/semantic-domain-inference.js";
import type { SemanticSystemModel } from "../../../../../shared/semantic-system-model.types.js";
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
  cards: ArchitectureStackCard[];
}

function readBusinessDomainName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed === UNASSIGNED_DOMAIN_KEY) return null;
  // Reject structural folder names (components/hooks/services/…) as domains.
  return normalizeBusinessDomainCandidate(trimmed) ? trimmed : null;
}

function resolveCardDomainName(
  card: ArchitectureStackCard,
  nodeById: Map<string, SoftwareGraphNode>,
  parentByChildId: Map<string, string>,
): string | null {
  const node = nodeById.get(card.id);
  const fromMetadata = readBusinessDomainName(node?.metadata?.domain);
  if (fromMetadata) return fromMetadata;

  const parentId = parentByChildId.get(card.id);
  const parent = parentId ? nodeById.get(parentId) : undefined;
  if (parent?.kind === "domain") return readBusinessDomainName(parent.label);

  return null;
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
    cards: [card],
  });
}

/**
 * RVP-6 primary projection: BusinessDomains from SemanticSystemModel, layers secondary.
 * Graph domain folders that are only structural (components/hooks/…) stay unassigned.
 */
export function groupArchitectureCardsBySemanticDomains(
  graph: SoftwareGraph,
  cards: ArchitectureStackCard[],
  semantic: SemanticSystemModel | null | undefined,
): ArchitectureDomainGroup[] {
  if (!semantic || semantic.entities.length === 0) {
    return groupArchitectureCardsByDomain(graph, cards);
  }

  const businessDomains = semantic.entities.filter((entity) => entity.kind === "business-domain");
  if (businessDomains.length === 0) {
    return groupArchitectureCardsByDomain(graph, cards);
  }

  const domainById = new Map(businessDomains.map((entity) => [entity.id, entity]));
  const domainIdByGraphNodeId = new Map<string, string>();
  for (const membership of semantic.memberships) {
    if (!domainById.has(membership.semanticEntityId)) continue;
    const current = domainIdByGraphNodeId.get(membership.graphNodeId);
    if (!current || membership.semanticEntityId.localeCompare(current) < 0) {
      domainIdByGraphNodeId.set(membership.graphNodeId, membership.semanticEntityId);
    }
  }

  const { childrenByParentId } = buildContainsIndex(graph);
  const groups = new Map<string, ArchitectureDomainGroup>();

  for (const card of cards) {
    const candidateNodeIds = collectDescendantGraphNodeIds(card.id, childrenByParentId);
    let matchedDomainId: string | null = null;
    for (const graphNodeId of candidateNodeIds) {
      const domainId = domainIdByGraphNodeId.get(graphNodeId);
      if (domainId) {
        matchedDomainId = domainId;
        break;
      }
    }
    // Also check the layer/card node itself and direct memberships.
    if (!matchedDomainId) {
      matchedDomainId = domainIdByGraphNodeId.get(card.id) ?? null;
    }

    const domain = matchedDomainId ? domainById.get(matchedDomainId) : undefined;
    pushCardIntoDomainGroup(groups, card, domain?.id ?? null, domain?.label ?? null);
  }

  return finalizeDomainGroups(groups);
}

export function groupArchitectureCardsByDomain(
  graph: SoftwareGraph,
  cards: ArchitectureStackCard[],
): ArchitectureDomainGroup[] {
  const { nodeById, parentByChildId } = buildContainsIndex(graph);
  const groups = new Map<string, ArchitectureDomainGroup>();

  for (const card of cards) {
    const domainName = resolveCardDomainName(card, nodeById, parentByChildId);
    pushCardIntoDomainGroup(groups, card, domainName, domainName);
  }

  return finalizeDomainGroups(groups);
}

export function hasRecognizedArchitectureDomains(groups: ArchitectureDomainGroup[]): boolean {
  return groups.some((group) => !group.isUnassigned);
}
