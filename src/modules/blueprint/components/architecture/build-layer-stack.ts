/**
 * Builds stack cards from contains-edges and groups them by real graph domains.
 */

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
  "Keine Domänen erkannt — gesucht nach Domain-Zuordnung in den Modul-Pfaden.";

export interface ArchitectureDomainGroup {
  id: string;
  label: string;
  isUnassigned: boolean;
  cards: ArchitectureStackCard[];
}

function readDomainName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed === UNASSIGNED_DOMAIN_KEY) return null;
  return trimmed;
}

function resolveCardDomainName(
  card: ArchitectureStackCard,
  nodeById: Map<string, SoftwareGraphNode>,
  parentByChildId: Map<string, string>,
): string | null {
  const node = nodeById.get(card.id);
  const fromMetadata = readDomainName(node?.metadata?.domain);
  if (fromMetadata) return fromMetadata;

  const parentId = parentByChildId.get(card.id);
  const parent = parentId ? nodeById.get(parentId) : undefined;
  if (parent?.kind === "domain") return readDomainName(parent.label);

  return null;
}

export function groupArchitectureCardsByDomain(
  graph: SoftwareGraph,
  cards: ArchitectureStackCard[],
): ArchitectureDomainGroup[] {
  const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
  const edges = Array.isArray(graph.edges) ? graph.edges : [];
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const parentByChildId = new Map<string, string>();
  for (const edge of edges) {
    if (edge.kind !== "contains") continue;
    parentByChildId.set(edge.targetId, edge.sourceId);
  }

  const groups = new Map<string, ArchitectureDomainGroup>();

  for (const card of cards) {
    const domainName = resolveCardDomainName(card, nodeById, parentByChildId);
    const isUnassigned = domainName == null;
    const id = isUnassigned ? UNASSIGNED_DOMAIN_KEY : domainName;
    const existing = groups.get(id);
    if (existing) {
      existing.cards.push(card);
      continue;
    }
    groups.set(id, {
      id,
      label: isUnassigned ? UNASSIGNED_DOMAIN_LABEL : domainName,
      isUnassigned,
      cards: [card],
    });
  }

  return [...groups.values()].sort((left, right) => {
    if (left.isUnassigned !== right.isUnassigned) return left.isUnassigned ? 1 : -1;
    return left.label.localeCompare(right.label);
  });
}

export function hasRecognizedArchitectureDomains(groups: ArchitectureDomainGroup[]): boolean {
  return groups.some((group) => !group.isUnassigned);
}
