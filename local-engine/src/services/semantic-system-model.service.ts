/**
 * Conservative projection from SoftwareGraph into the semantic Blueprint model.
 *
 * Only graph kinds with unambiguous semantics are promoted directly. Business
 * domains are inferred separately from corroborated resource evidence; roll-ups
 * and execution/deployment projections remain follow-up concerns.
 */

import type {
  SoftwareGraph,
  SoftwareGraphEdgeKind,
  SoftwareGraphNodeKind,
} from "../../../shared/software-graph.types.js";
import type {
  SemanticEntity,
  SemanticEntityKind,
  SemanticRelation,
  SemanticRelationKind,
  SemanticSystemModel,
} from "../../../shared/semantic-system-model.types.js";
import { inferBusinessDomainEntities } from "./semantic-domain-inference.js";

const DIRECT_ENTITY_KINDS: Partial<Record<SoftwareGraphNodeKind, SemanticEntityKind>> = {
  application: "application",
  service: "service",
  repository: "component",
  table: "data-store",
  external: "external-system",
};

const DIRECT_RELATION_KINDS: Partial<Record<SoftwareGraphEdgeKind, SemanticRelationKind>> = {
  contains: "contains",
  references: "depends-on",
  implements: "depends-on",
  imports: "depends-on",
  calls: "calls",
  api: "communicates-with",
  event: "communicates-with",
  data: "accesses-data",
  "external-dependency": "depends-on",
  authenticates: "authenticates",
  validates: "validates",
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
      metadata: {
        sourceGraphNodeId: node.id,
        sourceGraphNodeKind: node.kind,
      },
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
    const kind = DIRECT_RELATION_KINDS[edge.kind];
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
      metadata: {
        sourceGraphEdgeId: edge.id,
        sourceGraphEdgeKind: edge.kind,
      },
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

  relations.sort((left, right) => left.id.localeCompare(right.id));
  return relations;
}

export function buildSemanticSystemModel(graph: SoftwareGraph): SemanticSystemModel {
  const { entities, entityIdByGraphNodeId } = projectEntities(graph);
  return {
    version: 1,
    projectId: graph.projectId,
    analyzedAt: graph.analyzedAt,
    entities,
    relations: projectRelations(graph, entities, entityIdByGraphNodeId),
  };
}
