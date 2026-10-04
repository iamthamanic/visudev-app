/** Canonical SemanticSystemModel builder shared by Local Engine and Blueprint UI (v2). */

import type { KnowledgeStatus } from "./scan-detector/epistemic.js";
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
import { isSecurityControlLabel, knowledgeStatusFromSignals } from "./semantic-taxonomy-v2.js";

const DIRECT_ENTITY_KINDS: Partial<Record<SoftwareGraphNodeKind, SemanticEntityKind>> = {
  application: "application",
  service: "service",
  repository: "technical-module",
  module: "technical-module",
  table: "data-store",
  external: "external-system",
  route: "endpoint",
  runtime: "runtime",
};

function semanticEntityId(kind: SemanticEntityKind, graphNodeId: string): string {
  return `semantic:${kind}:${graphNodeId}`;
}

function directKnowledgeStatus(kind: SemanticEntityKind): KnowledgeStatus {
  // Direct graph promotions are strong static evidence.
  if (
    kind === "application" ||
    kind === "service" ||
    kind === "data-store" ||
    kind === "external-system" ||
    kind === "endpoint" ||
    kind === "technical-module" ||
    kind === "runtime" ||
    kind === "security-control" ||
    kind === "deployment-unit"
  ) {
    return "SUPPORTED";
  }
  return "INTERPRETED";
}

function projectEntities(graph: SoftwareGraph): {
  entities: SemanticEntity[];
  entityIdByGraphNodeId: Map<string, string>;
} {
  const entityIdByGraphNodeId = new Map<string, string>();
  const entities: SemanticEntity[] = [];
  for (const node of graph.nodes) {
    let kind = DIRECT_ENTITY_KINDS[node.kind];
    if (node.kind === "service" && isSecurityControlLabel(node.label)) {
      kind = "security-control";
    }
    if (!kind || entityIdByGraphNodeId.has(node.id)) continue;
    const id = semanticEntityId(kind, node.id);
    entityIdByGraphNodeId.set(node.id, id);
    entities.push({
      id,
      kind,
      label: node.label,
      confidence: 1,
      knowledgeStatus: directKnowledgeStatus(kind),
      evidence: [{ source: "graph-node", refId: node.id }],
      metadata: {
        sourceGraphNodeId: node.id,
        sourceGraphNodeKind: node.kind,
        taxonomyVersion: 2,
      },
    });
  }
  entities.push(...inferBusinessDomainEntities(graph));
  entities.sort((left, right) => left.id.localeCompare(right.id));
  return { entities, entityIdByGraphNodeId };
}

function appendInferredDomainRelations(
  entities: readonly SemanticEntity[],
  relationIds: Set<string>,
  relations: SemanticRelation[],
): void {
  const applications = entities.filter((entity) => entity.kind === "application");
  const application = applications.length === 1 ? applications[0] : undefined;
  if (!application) return;
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
      knowledgeStatus: domain.knowledgeStatus,
      evidence: [...domain.evidence],
      metadata: { derivedFrom: "business-domain-inference", taxonomyVersion: 2 },
    });
  }
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
    if (!sourceId || !targetId) continue;
    const id = `semantic-relation:${kind}:${edge.id}`;
    if (relationIds.has(id)) continue;
    relationIds.add(id);
    relations.push({
      id,
      kind,
      sourceId,
      targetId,
      confidence: 1,
      knowledgeStatus: knowledgeStatusFromSignals({
        sourceKindCount: 1,
        maxConfidence: 1,
        origin: "static",
      }),
      evidence: [{ source: "graph-edge", refId: edge.id }],
      metadata: {
        sourceGraphEdgeId: edge.id,
        sourceGraphEdgeKind: edge.kind,
        taxonomyVersion: 2,
      },
    });
  }
  appendInferredDomainRelations(entities, relationIds, relations);
  return relations.sort((left, right) => left.id.localeCompare(right.id));
}

export function buildSemanticSystemModel(graph: SoftwareGraph): SemanticSystemModel {
  const { entities, entityIdByGraphNodeId } = projectEntities(graph);
  const directRelations = projectRelations(graph, entities, entityIdByGraphNodeId);
  const rollup = buildSemanticRollup(graph, entities);
  // Ensure rollup relations carry knowledgeStatus for v2.
  const rollupRelations = rollup.relations.map((relation) => ({
    ...relation,
    knowledgeStatus:
      relation.knowledgeStatus ??
      knowledgeStatusFromSignals({
        sourceKindCount: 1,
        maxConfidence: relation.confidence,
        origin: "heuristic",
      }),
  }));
  return {
    version: 2,
    projectId: graph.projectId,
    analyzedAt: graph.analyzedAt,
    entities,
    memberships: rollup.memberships,
    relations: [...directRelations, ...rollupRelations].sort((left, right) =>
      left.id.localeCompare(right.id),
    ),
  };
}
