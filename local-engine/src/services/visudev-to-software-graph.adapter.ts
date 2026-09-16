/**
 * Adapts Deno VisuDevGraph into SoftwareGraph and merges with fact-built graphs.
 * Location: local-engine/src/services/visudev-to-software-graph.adapter.ts
 *
 * Goal: stop discarding Deno control edges at the local-engine boundary while
 * keeping the architecture hierarchy from buildSoftwareGraph.
 */

import type {
  RawBlueprintScan,
  RawVisuDevGraph,
  SoftwareGraph,
  SoftwareGraphEdge,
  SoftwareGraphEdgeKind,
  SoftwareGraphEvidence,
  SoftwareGraphNode,
  SoftwareGraphNodeKind,
  SoftwareGraphScope,
} from "../types/api.types.js";
import { createApplicationScope, createOrganizationScope } from "./software-graph/_scopes.js";

const NODE_KIND_MAP: Record<string, SoftwareGraphNodeKind> = {
  route: "route",
  auth: "service",
  validation: "service",
  "rate-limit": "service",
  table: "table",
  external_api: "external",
};

const EDGE_KIND_MAP: Record<string, SoftwareGraphEdgeKind> = {
  reads: "data",
  writes: "data",
  validates: "validates",
  authenticates: "authenticates",
  calls: "calls",
  rate_limits: "references",
};

export function isUsableVisuDevGraph(value: unknown): value is RawVisuDevGraph {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const graph = value as Record<string, unknown>;
  return (
    graph.version === 1 &&
    Array.isArray(graph.nodes) &&
    Array.isArray(graph.edges) &&
    Array.isArray(graph.evidence) &&
    (graph.nodes as unknown[]).length + (graph.edges as unknown[]).length > 0
  );
}

function mapNodeKind(kind: string): SoftwareGraphNodeKind {
  return NODE_KIND_MAP[kind] ?? "symbol";
}

function mapEdgeKind(kind: string): SoftwareGraphEdgeKind {
  return EDGE_KIND_MAP[kind] ?? "references";
}

function evidenceKindForEdge(edgeKind: string, state?: string): "extracted" | "inferred" {
  if (state === "confirmed") return "extracted";
  if (edgeKind === "calls" || edgeKind === "reads" || edgeKind === "writes") return "extracted";
  return "inferred";
}

/**
 * Convert Deno VisuDevGraph into a SoftwareGraph with org/app scopes.
 * Route pipelines from the scan are attached onto matching route nodes.
 */
export function adaptVisuDevGraphToSoftwareGraph(
  visuDev: RawVisuDevGraph,
  scan: Pick<RawBlueprintScan, "projectId" | "analyzedAt" | "routes">,
): SoftwareGraph {
  const projectId = scan.projectId;
  const org = createOrganizationScope(projectId);
  const app = createApplicationScope(projectId);
  const scopes: SoftwareGraphScope[] = [org, app];
  const scopeIds = new Set<string>([org.id, app.id]);

  for (const scope of visuDev.scopes ?? []) {
    if (!scope?.id || scopeIds.has(scope.id)) continue;
    scopes.push({
      level: "module",
      id: scope.id,
      label: typeof scope.label === "string" ? scope.label : scope.id,
      parentId: app.id,
    });
    scopeIds.add(scope.id);
  }

  const pipelineByRouteId = new Map<string, unknown[]>();
  for (const route of scan.routes) {
    if (Array.isArray(route.pipeline) && route.pipeline.length > 0) {
      pipelineByRouteId.set(route.id, route.pipeline);
    }
  }

  const nodes: SoftwareGraphNode[] = [
    { id: org.id, kind: "organization", label: projectId, metadata: {} },
    { id: app.id, kind: "application", label: projectId, scopeId: org.id, metadata: {} },
  ];

  for (const node of visuDev.nodes) {
    if (!node?.id) continue;
    const kind = mapNodeKind(node.kind);
    const metadata: Record<string, unknown> = {
      ...(node.metadata ?? {}),
      visuDevKind: node.kind,
      detectionState: node.state,
      provenance: "visudev-graph",
    };
    if (kind === "route") {
      const routeId =
        typeof metadata.routeId === "string" && metadata.routeId.length > 0
          ? metadata.routeId
          : node.id;
      metadata.routeId = routeId;
      if (typeof metadata.method !== "string") {
        const parts = node.label.trim().split(/\s+/);
        if (parts.length >= 2) {
          metadata.method = parts[0];
          metadata.path = parts.slice(1).join(" ");
        }
      }
      const pipeline = pipelineByRouteId.get(String(routeId)) ?? pipelineByRouteId.get(node.id);
      if (pipeline) {
        metadata.pipeline = pipeline;
        metadata.pipelineCount = pipeline.length;
      }
    }
    if (kind === "service" && node.kind === "auth") metadata.role = "auth";
    if (kind === "service" && node.kind === "validation") metadata.role = "validation";
    if (kind === "service" && node.kind === "rate-limit") metadata.role = "rate-limit";

    nodes.push({
      id: node.id,
      kind,
      label: node.label,
      scopeId: typeof node.scopeId === "string" ? node.scopeId : app.id,
      filePath: node.filePath,
      line: node.line,
      metadata,
    });
  }

  const edges: SoftwareGraphEdge[] = [
    {
      id: `edge:${org.id}:${app.id}`,
      kind: "contains",
      sourceId: org.id,
      targetId: app.id,
      metadata: { evidenceKind: "inferred", provenance: "visudev-adapter" },
    },
  ];

  for (const edge of visuDev.edges) {
    if (!edge?.id || !edge.fromNodeId || !edge.toNodeId) continue;
    edges.push({
      id: edge.id,
      kind: mapEdgeKind(edge.kind),
      sourceId: edge.fromNodeId,
      targetId: edge.toNodeId,
      metadata: {
        ...(edge.metadata ?? {}),
        visuDevKind: edge.kind,
        detectionState: edge.state,
        evidenceKind: evidenceKindForEdge(edge.kind, edge.state),
        provenance: "visudev-graph",
      },
    });
  }

  const evidence: SoftwareGraphEvidence[] = visuDev.evidence
    .filter((item) => item?.id && item.factId)
    .map((item) => ({
      id: item.id,
      factId: item.factId,
      kind: item.summary ?? "visudev-evidence",
      filePath: item.filePath,
      line: item.line,
      excerpt: item.snippet,
      nodeId: item.subjectType === "node" ? item.subjectId : undefined,
      edgeId: item.subjectType === "edge" ? item.subjectId : undefined,
    }));

  return {
    version: 1,
    projectId,
    analyzedAt: scan.analyzedAt,
    scopes,
    nodes,
    edges,
    evidence,
    groups: [],
    metrics: [
      { id: "nodes", name: "nodes", value: nodes.length },
      { id: "edges", name: "edges", value: edges.length },
    ],
    condensed: false,
    limits: { maxNodes: 5000, maxEdges: 10000 },
  };
}

/** Union two SoftwareGraphs; `base` wins on id collisions for nodes/edges.
 * Route nodes are also reconciled by routeId / method+path so Deno `node-route-*`
 * and fact `route:…` identities collapse to one node.
 */
export function mergeSoftwareGraphs(base: SoftwareGraph, extra: SoftwareGraph): SoftwareGraph {
  const nodesById = new Map(base.nodes.map((node) => [node.id, node]));
  const routeKeyToId = new Map<string, string>();
  for (const node of base.nodes) {
    const key = routeSemanticKey(node);
    if (key) routeKeyToId.set(key, node.id);
  }

  const idRemap = new Map<string, string>();

  for (const node of extra.nodes) {
    const key = routeSemanticKey(node);
    const existingId = key ? routeKeyToId.get(key) : undefined;
    if (existingId && existingId !== node.id) {
      idRemap.set(node.id, existingId);
      const existing = nodesById.get(existingId)!;
      nodesById.set(existingId, {
        ...existing,
        metadata: { ...node.metadata, ...existing.metadata },
        filePath: existing.filePath ?? node.filePath,
        line: existing.line ?? node.line,
      });
      continue;
    }
    if (!nodesById.has(node.id)) {
      nodesById.set(node.id, node);
      if (key) routeKeyToId.set(key, node.id);
    } else {
      const existing = nodesById.get(node.id)!;
      nodesById.set(node.id, {
        ...existing,
        metadata: { ...node.metadata, ...existing.metadata },
        filePath: existing.filePath ?? node.filePath,
        line: existing.line ?? node.line,
      });
    }
  }

  const remapId = (id: string): string => idRemap.get(id) ?? id;

  const edgesById = new Map(base.edges.map((edge) => [edge.id, edge]));
  for (const edge of extra.edges) {
    const remapped: SoftwareGraphEdge = {
      ...edge,
      sourceId: remapId(edge.sourceId),
      targetId: remapId(edge.targetId),
    };
    if (!edgesById.has(remapped.id)) edgesById.set(remapped.id, remapped);
  }

  const evidenceById = new Map(base.evidence.map((item) => [item.id, item]));
  for (const item of extra.evidence) {
    if (!evidenceById.has(item.id)) {
      evidenceById.set(item.id, {
        ...item,
        nodeId: item.nodeId ? remapId(item.nodeId) : item.nodeId,
        edgeId: item.edgeId,
      });
    }
  }

  const scopesById = new Map(base.scopes.map((scope) => [scope.id, scope]));
  for (const scope of extra.scopes) {
    if (!scopesById.has(scope.id)) scopesById.set(scope.id, scope);
  }

  const groupsById = new Map(base.groups.map((group) => [group.id, group]));
  for (const group of extra.groups) {
    if (!groupsById.has(group.id)) groupsById.set(group.id, group);
  }

  const nodes = [...nodesById.values()];
  const edges = [...edgesById.values()];

  return {
    ...base,
    scopes: [...scopesById.values()],
    nodes,
    edges,
    evidence: [...evidenceById.values()],
    groups: [...groupsById.values()],
    metrics: [
      { id: "nodes", name: "nodes", value: nodes.length },
      { id: "edges", name: "edges", value: edges.length },
    ],
    condensed: base.condensed || extra.condensed,
  };
}

function routeSemanticKey(node: SoftwareGraphNode): string | null {
  if (node.kind !== "route") return null;
  const routeId =
    typeof node.metadata?.routeId === "string" && node.metadata.routeId.length > 0
      ? node.metadata.routeId
      : null;
  if (routeId) return `routeId:${routeId}`;
  const method =
    typeof node.metadata?.method === "string" ? node.metadata.method.toUpperCase() : "";
  const path = typeof node.metadata?.path === "string" ? node.metadata.path : "";
  if (method && path) return `mp:${method} ${path}`;
  const label = node.label?.trim();
  return label ? `label:${label}` : null;
}

/**
 * Prefer denser merged graph: fact rebuild for hierarchy + VisuDev for control edges.
 */
export function resolveSoftwareGraphFromScan(
  scan: RawBlueprintScan,
  factBuilt: SoftwareGraph,
): SoftwareGraph {
  if (!isUsableVisuDevGraph(scan.visuDevGraph)) return factBuilt;
  const adapted = adaptVisuDevGraphToSoftwareGraph(scan.visuDevGraph, scan);
  return mergeSoftwareGraphs(factBuilt, adapted);
}
