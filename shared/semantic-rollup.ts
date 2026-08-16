import type { SoftwareGraph, SoftwareGraphNode } from "./software-graph.types.js";
import type {
  SemanticEntity,
  SemanticMembership,
  SemanticRelation,
  SemanticRelationKind,
} from "./semantic-system-model.types.js";
import { normalizeBusinessDomainCandidate } from "./semantic-domain-inference.js";
import { resolveSemanticRelationKind } from "./semantic-relation-kind.js";

interface SemanticRollup {
  memberships: SemanticMembership[];
  relations: SemanticRelation[];
}

interface MembershipAccumulator {
  graphNodeId: string;
  semanticEntityId: string;
  confidence: number;
  evidenceIds: Set<string>;
}

interface RelationAccumulator {
  id: string;
  kind: SemanticRelationKind;
  sourceId: string;
  targetId: string;
  confidence: number;
  edgeIds: Set<string>;
}

function membershipKey(graphNodeId: string, semanticEntityId: string): string {
  return `${graphNodeId}\u0000${semanticEntityId}`;
}

function addMembership(
  memberships: Map<string, MembershipAccumulator>,
  graphNodeId: string,
  semanticEntityId: string,
  confidence: number,
  evidenceGraphNodeId: string,
): void {
  const key = membershipKey(graphNodeId, semanticEntityId);
  const current = memberships.get(key) ?? {
    graphNodeId,
    semanticEntityId,
    confidence: 0,
    evidenceIds: new Set<string>(),
  };
  current.confidence = Math.max(current.confidence, confidence);
  current.evidenceIds.add(evidenceGraphNodeId);
  memberships.set(key, current);
}

function sourceGraphNodeId(entity: SemanticEntity): string | null {
  const value = entity.metadata.sourceGraphNodeId;
  return typeof value === "string" && value.length > 0 ? value : null;
}

function businessDomainKey(entity: SemanticEntity): string | null {
  if (entity.kind !== "business-domain") return null;
  const value = entity.metadata.candidateKey;
  return typeof value === "string" && value.length > 0 ? value : null;
}

function graphNodePathTokens(node: SoftwareGraphNode): string[] {
  if (!node.filePath) return [];
  return node.filePath
    .split(/[\\/]/)
    .map((part) => normalizeBusinessDomainCandidate(part))
    .filter((part): part is string => Boolean(part));
}

function findCorroboratedDomainEntityByGraphDomain(
  graph: SoftwareGraph,
  entities: readonly SemanticEntity[],
): Map<string, SemanticEntity> {
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const result = new Map<string, SemanticEntity>();
  for (const entity of entities) {
    if (entity.kind !== "business-domain") continue;
    for (const evidence of entity.evidence) {
      if (evidence.source !== "graph-node") continue;
      const node = nodeById.get(evidence.refId);
      if (node?.kind === "domain") result.set(node.id, entity);
    }
  }
  return result;
}

function findAncestorGraphDomain(
  node: SoftwareGraphNode,
  nodeById: ReadonlyMap<string, SoftwareGraphNode>,
): string | null {
  let parentId = node.scopeId;
  const visited = new Set<string>();
  for (let depth = 0; parentId && depth < 8; depth += 1) {
    if (visited.has(parentId)) return null;
    visited.add(parentId);
    const parent = nodeById.get(parentId);
    if (!parent) return null;
    if (parent.kind === "domain") return parent.id;
    parentId = parent.scopeId;
  }
  return null;
}

function addDirectEntityMemberships(
  entities: readonly SemanticEntity[],
  memberships: Map<string, MembershipAccumulator>,
): void {
  for (const entity of entities) {
    const graphNodeId = sourceGraphNodeId(entity);
    if (graphNodeId) addMembership(memberships, graphNodeId, entity.id, 1, graphNodeId);
  }
}

function addDomainEvidenceMemberships(
  entities: readonly SemanticEntity[],
  memberships: Map<string, MembershipAccumulator>,
): void {
  for (const entity of entities) {
    if (entity.kind !== "business-domain") continue;
    for (const evidence of entity.evidence) {
      if (evidence.source === "graph-node") {
        addMembership(memberships, evidence.refId, entity.id, entity.confidence, evidence.refId);
      }
    }
  }
}

function addDomainDescendantMemberships(
  graph: SoftwareGraph,
  entities: readonly SemanticEntity[],
  memberships: Map<string, MembershipAccumulator>,
): void {
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const domainByGraphDomainId = findCorroboratedDomainEntityByGraphDomain(graph, entities);
  for (const node of graph.nodes) {
    const ancestorDomainId = findAncestorGraphDomain(node, nodeById);
    if (!ancestorDomainId) continue;
    const semanticDomain = domainByGraphDomainId.get(ancestorDomainId);
    if (semanticDomain) addMembership(memberships, node.id, semanticDomain.id, 0.85, ancestorDomainId);
  }
}

function addPathTokenMemberships(
  graph: SoftwareGraph,
  entities: readonly SemanticEntity[],
  memberships: Map<string, MembershipAccumulator>,
): void {
  const domainByKey = new Map<string, SemanticEntity>();
  for (const entity of entities) {
    const key = businessDomainKey(entity);
    if (key) domainByKey.set(key, entity);
  }
  for (const node of graph.nodes) {
    const matchedIds = new Set<string>();
    for (const token of graphNodePathTokens(node)) {
      const domain = domainByKey.get(token);
      if (domain) matchedIds.add(domain.id);
    }
    if (matchedIds.size !== 1) continue;
    const semanticEntityId = [...matchedIds][0];
    if (semanticEntityId) addMembership(memberships, node.id, semanticEntityId, 0.7, node.id);
  }
}

function finalizeMemberships(
  accumulated: ReadonlyMap<string, MembershipAccumulator>,
): SemanticMembership[] {
  return [...accumulated.values()]
    .map((membership): SemanticMembership => ({
      graphNodeId: membership.graphNodeId,
      semanticEntityId: membership.semanticEntityId,
      confidence: Math.round(membership.confidence * 100) / 100,
      evidence: [...membership.evidenceIds]
        .sort()
        .map((refId) => ({ source: "graph-node" as const, refId })),
    }))
    .sort((left, right) =>
      `${left.semanticEntityId}\u0000${left.graphNodeId}`.localeCompare(
        `${right.semanticEntityId}\u0000${right.graphNodeId}`,
      ),
    );
}

function preferredDomainMemberships(
  memberships: readonly SemanticMembership[],
  entities: readonly SemanticEntity[],
): Map<string, SemanticMembership> {
  const entityById = new Map(entities.map((entity) => [entity.id, entity]));
  const candidates = new Map<string, SemanticMembership[]>();
  for (const membership of memberships) {
    if (entityById.get(membership.semanticEntityId)?.kind !== "business-domain") continue;
    const list = candidates.get(membership.graphNodeId) ?? [];
    list.push(membership);
    candidates.set(membership.graphNodeId, list);
  }
  const preferred = new Map<string, SemanticMembership>();
  for (const [graphNodeId, options] of candidates) {
    const sorted = [...options].sort((left, right) => right.confidence - left.confidence);
    const first = sorted[0];
    if (!first) continue;
    const second = sorted[1];
    if (second && second.confidence === first.confidence) continue;
    preferred.set(graphNodeId, first);
  }
  return preferred;
}

function aggregateRelations(
  graph: SoftwareGraph,
  entities: readonly SemanticEntity[],
  memberships: readonly SemanticMembership[],
): SemanticRelation[] {
  const preferred = preferredDomainMemberships(memberships, entities);
  const accumulated = new Map<string, RelationAccumulator>();
  for (const edge of graph.edges) {
    if (edge.kind === "contains") continue;
    const kind = resolveSemanticRelationKind(edge.kind);
    const source = preferred.get(edge.sourceId);
    const target = preferred.get(edge.targetId);
    if (!kind || !source || !target || source.semanticEntityId === target.semanticEntityId) continue;
    const id = `semantic-rollup:${kind}:${source.semanticEntityId}:${target.semanticEntityId}`;
    const current = accumulated.get(id) ?? {
      id,
      kind,
      sourceId: source.semanticEntityId,
      targetId: target.semanticEntityId,
      confidence: 1,
      edgeIds: new Set<string>(),
    };
    current.confidence = Math.min(current.confidence, source.confidence, target.confidence);
    current.edgeIds.add(edge.id);
    accumulated.set(id, current);
  }
  return [...accumulated.values()]
    .map((relation): SemanticRelation => {
      const edgeIds = [...relation.edgeIds].sort();
      return {
        id: relation.id,
        kind: relation.kind,
        sourceId: relation.sourceId,
        targetId: relation.targetId,
        confidence: Math.round(relation.confidence * 100) / 100,
        evidence: edgeIds.map((refId) => ({ source: "graph-edge", refId })),
        metadata: {
          projectionLevel: "business-domain",
          weight: edgeIds.length,
          sourceGraphEdgeIds: edgeIds,
        },
      };
    })
    .sort((left, right) => left.id.localeCompare(right.id));
}

export function buildSemanticRollup(
  graph: SoftwareGraph,
  entities: readonly SemanticEntity[],
): SemanticRollup {
  const accumulated = new Map<string, MembershipAccumulator>();
  addDirectEntityMemberships(entities, accumulated);
  addDomainEvidenceMemberships(entities, accumulated);
  addDomainDescendantMemberships(graph, entities, accumulated);
  addPathTokenMemberships(graph, entities, accumulated);
  const memberships = finalizeMemberships(accumulated);
  return { memberships, relations: aggregateRelations(graph, entities, memberships) };
}
