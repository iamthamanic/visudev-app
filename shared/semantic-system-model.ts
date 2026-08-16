/** Canonical SemanticSystemModel builder shared by Local Engine and Blueprint UI. */

import type { SoftwareGraph, SoftwareGraphNodeKind } from "./software-graph.types.js";
import type {
  SemanticEntity,
  SemanticEntityKind,
  SemanticRelation,
  SemanticSystemModel,
} from "./semantic-system-model.types.js";
import { inferBusinessDomainEntities } from "./semantic-domain-inference.js";
import { resolveSemanticRelationKind } from "./semantic-relation-kind.js";
import { buildSemanticRollup } from "./semantic-rollup.js";

const DIRECT_ENTITY_KINDS: Partial<Record<SoftwareGraphNodeKind, SemanticEntityKind>> = {
  application: "application",
  service: "service",
  repository: "component",
  table: "data-store",
  external: "external-system",
};

function semanticEntityId(kind: SemanticEntityKind, graphNodeId: string): string {
  return `semantic:${kind}:${graphNodeId}`;
}

function projectEntities(graph: SoftwareGraph): {
  entities: SemanticEntity[];
  entityIdByGraphNodeId: Map<string, string>;
} {
  const entityIdByGraphNodeId = new Map<string, string>();
  const entities: SemanticEntity[] = [];
  for (const node of graph.nodes) {
    const kind = DIRECT_ENTITY_KINDS[node.kind];
    if (!kind || entityIdByGraphNodeId.has(node.id)) continue;
    const id = semanticEntityId(kind, node.id);
    entityIdByGraphNodeId.set(node.id, id);
    entities.push({
      id,
      kind,
      label: node.label,
      confidence: 1,
      evidence: [{ source: "graph-node", refId: node.id }],
      metadata: { sourceGraphNodeId: node.id, sourceGraphNodeKind: node.kind },
    });
  }
  entities.push(...inferBusinessDomainEntities(graph));
  entities.sort((left, right) => left.id.localeCompare(right.id));
  return { entities, entityIdByGraphNodeId };
}

function projectRelations(
  graph: SoftwareGraph,
  entities: readonly SemanticEntity[],
  entityIdByGraphNodeId: ReadonlyMap<string, string>,
): SemanticRelation[] {
  const relationIds = new Set<string>();
  const relations: SemanticRelation[] = [];
  for (const edge of graph.edges) {
    const kind = resolveSemanticRelationKind(edge.kind);
    const sourceId = entityIdByGraphNodeId.get(edge.sourceId);
    const targetId = entityIdByGraphNodeId.get(edge.targetId);
    if (!kind || !sourceId || !targetId) continue;
    const id = `semantic-relation:${kind}:${edge.id}`;
    if (relationIds.has(id)) continue;
    relationIds.add(id);
    relations.push({
      id,
      kind,
      sourceId,
      targetId,
      confidence: 1,
      evidence: [{ source: "graph-edge", refId: edge.id }],
      metadata: { sourceGraphEdgeId: edge.id, sourceGraphEdgeKind: edge.kind },
    });
  }
  const application = entities.find((entity) => entity.kind === "application");
  if (application) {
    for (const domain of entities.filter((entity) => entity.kind === "business-domain")) {
      const id = `semantic-relation:contains:${application.id}:${domain.id}`;
      if (relationIds.has(id)) continue;
      relationIds.add(id);
      relations.push({
        id,
        kind: "contains",
        sourceId: application.id,
        targetId: domain.id,
        confidence: domain.confidence,
        evidence: [...domain.evidence],
        metadata: { derivedFrom: "business-domain-inference" },
      });
    }
  }
  return relations.sort((left, right) => left.id.localeCompare(right.id));
}

export function buildSemanticSystemModel(graph: SoftwareGraph): SemanticSystemModel {
  const { entities, entityIdByGraphNodeId } = projectEntities(graph);
  const directRelations = projectRelations(graph, entities, entityIdByGraphNodeId);
  const rollup = buildSemanticRollup(graph, entities);
  return {
    version: 1,
    projectId: graph.projectId,
    analyzedAt: graph.analyzedAt,
    entities,
    memberships: rollup.memberships,
    relations: [...directRelations, ...rollup.relations].sort((left, right) =>
      left.id.localeCompare(right.id),
    ),
  };
}
