/**
 * Builds a neutral SoftwareGraph from a RawBlueprintScan.
 * Location: local-engine/src/services/software-graph-builder.service.ts
 *
 * This module only orchestrates the pipeline. All logic lives in focused
 * modules under software-graph/ so each file has a single reason to change.
 */

import type {
  RawBlueprintFact,
  RawBlueprintRoute,
  RawBlueprintScan,
  SoftwareGraph,
} from "../types/api.types.js";
import { addFactEvidence } from "./software-graph/_fact-evidence.js";
import { addDependencyFactEdge } from "./software-graph/_dependency-edges.js";
import { attachExecutionPathGroups } from "./software-graph/_execution-paths.js";
import { ensureFileContext } from "./software-graph/_file-context.js";
import { createId, stableUniqueId } from "./software-graph/_ids.js";
import { partitionPrismaModelFacts } from "./software-graph/_prisma-models.js";
import { partitionInfraServiceFacts } from "./software-graph/_infra-services.js";
import { addRouteNodes } from "./software-graph/_route-nodes.js";
import { buildRuntimeGroups, dropDanglingEdges } from "./software-graph/_runtime-groups.js";
import { createApplicationScope, createOrganizationScope } from "./software-graph/_scopes.js";
import { buildSegmentSpreadIndex } from "./software-graph/_segment-spread.js";
import { applyFilenameDomains } from "./software-graph/_domain-from-filename.js";
import {
  addEdge,
  addNode,
  createBuilderState,
  DEFAULT_LIMITS,
  registerRootScope,
} from "./software-graph/_state.js";
import { normalizeFact, normalizeRoute, validateScan } from "./software-graph/_validation.js";

export function buildSoftwareGraph(scan: RawBlueprintScan): SoftwareGraph {
  const validationError = validateScan(scan);
  if (validationError) {
    throw new Error(`Invalid RawBlueprintScan: ${validationError}`);
  }

  const projectId = scan.projectId;
  const projectAppScope = createApplicationScope(projectId);
  const projectOrgScope = createOrganizationScope(projectId);
  const state = createBuilderState();

  registerRootScope(state, projectOrgScope);
  registerRootScope(state, projectAppScope);
  addNode(state, { id: projectOrgScope.id, kind: "organization", label: projectId, metadata: {} });
  addNode(state, {
    id: projectAppScope.id,
    kind: "application",
    label: projectId,
    scopeId: projectOrgScope.id,
    metadata: {},
  });
  addEdge(state, {
    id: createId("edge", projectOrgScope.id, projectAppScope.id),
    kind: "contains",
    sourceId: projectOrgScope.id,
    targetId: projectAppScope.id,
    metadata: {},
  });

  const routes = scan.routes
    .map(normalizeRoute)
    .filter((route): route is RawBlueprintRoute => route !== null);
  const facts = scan.facts
    .map(normalizeFact)
    .filter((fact): fact is RawBlueprintFact => fact !== null);

  // P0-10: one spread index for the whole scan. Prefer pathCatalog (walk
  // diversity) so thin fact-export sets (erpnext) still yield domain trees.
  const catalogPaths = new Set<string>();
  const addPath = (value: unknown): void => {
    if (typeof value === "string" && value.trim().length > 0) {
      catalogPaths.add(value.trim());
    }
  };
  for (const path of scan.pathCatalog ?? []) {
    addPath(path);
  }
  for (const fact of facts) {
    addPath(fact.filePath);
    addPath(fact.metadata?.resolvedPath);
    addPath(fact.metadata?.targetFile);
  }
  for (const route of routes) {
    addPath(route.filePath);
  }
  state.segmentSpread = buildSegmentSpreadIndex([...catalogPaths]);

  // P2-1: promote all Prisma schema models to table nodes BEFORE route flood
  // consumes the soft node budget (browo: 473 routes starved LeaveRequest @ idx 36).
  // P3-2: promote compose/datasource infra engines first (Postgres/Redis).
  const { prismaModels, other: afterPrisma } = partitionPrismaModelFacts(facts);
  const { infraServices, other: otherFacts } = partitionInfraServiceFacts(afterPrisma);

  const ingestFact = (fact: RawBlueprintFact): void => {
    const { fileId } = ensureFileContext(fact.filePath, projectId, state);
    addFactEvidence(fact, fileId, state);
    addDependencyFactEdge(fact, fileId, projectId, state);
  };

  for (const fact of infraServices) ingestFact(fact);
  for (const fact of prismaModels) ingestFact(fact);

  for (const route of routes) {
    const { fileId, moduleId } = ensureFileContext(route.filePath, projectId, state);
    addRouteNodes(route, fileId, moduleId, state);
  }

  for (const fact of otherFacts) ingestFact(fact);

  // P0-14 Pass 2: filename stems for layer-first files still on unassigned/none.
  applyFilenameDomains(state, projectId);

  const runtimeNodeId = stableUniqueId(state.registry, "node", `runtime:${projectId}`);
  const runtimes = [
    ...new Set(
      [...state.nodes.values()]
        .filter((n) => n.kind === "file")
        .map((n) => n.metadata.runtime as string)
        .filter(Boolean),
    ),
  ];
  addNode(state, {
    id: runtimeNodeId,
    kind: "runtime",
    label: "runtime",
    scopeId: projectAppScope.id,
    metadata: { runtimes },
  });
  addEdge(state, {
    id: stableUniqueId(state.registry, "edge", createId("edge", projectAppScope.id, runtimeNodeId)),
    kind: "contains",
    sourceId: projectAppScope.id,
    targetId: runtimeNodeId,
    metadata: {},
  });

  const nodeArray = [...state.nodes.values()];
  const nodeIds = new Set(state.nodes.keys());
  const edgeArray = dropDanglingEdges([...state.edges.values()], nodeIds);
  const executionGroups = attachExecutionPathGroups(state);
  const groups = [...buildRuntimeGroups(nodeArray), ...executionGroups];

  return {
    version: 1,
    projectId,
    analyzedAt: scan.analyzedAt,
    scopes: [...state.scopes.values()],
    nodes: nodeArray,
    edges: edgeArray,
    evidence: state.evidence,
    groups,
    metrics: [
      { id: "metric:files", name: "filesAnalyzed", value: scan.filesAnalyzed },
      { id: "metric:routes", name: "routesDetected", value: routes.length },
      { id: "metric:facts", name: "factsDetected", value: facts.length },
      { id: "metric:nodes", name: "nodeCount", value: state.attemptedNodes },
      { id: "metric:edges", name: "edgeCount", value: state.attemptedEdges },
    ],
    condensed: state.condensed,
    limits: { ...DEFAULT_LIMITS },
  };
}
