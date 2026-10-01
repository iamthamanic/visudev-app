/**
 * Merges AppFlow runtime crawl observations into Blueprint SoftwareGraph.
 * Location: local-engine/src/services/runtime-into-software-graph.ts
 *
 * Observed edges/nodes are tagged provenance: "observed". Never invents
 * static evidence — only attaches what the crawl recorded.
 */

import type { SoftwareGraph, SoftwareGraphEdge, SoftwareGraphNode } from "../types/api.types.js";

export type RuntimeVerifiedEdgeLike = {
  fromScreenId: string;
  toScreenId?: string;
  type: string;
  targetPath?: string;
  sourceRoute?: string;
  targetRoute?: string;
  verification?: string;
};

export type RuntimeCrawlLike = {
  crawledAt?: string;
  verifiedEdges?: RuntimeVerifiedEdgeLike[];
  snapshots?: Array<{ screenId: string; route: string; title?: string }>;
};

function findRouteNode(
  nodes: SoftwareGraphNode[],
  routeHint: string | undefined,
): SoftwareGraphNode | undefined {
  if (!routeHint) return undefined;
  const normalized = routeHint.trim();
  if (!normalized) return undefined;
  return nodes.find((node) => {
    if (node.kind !== "route") return false;
    const path = typeof node.metadata.path === "string" ? node.metadata.path : "";
    const label = node.label;
    return path === normalized || label.includes(normalized) || node.id.includes(normalized);
  });
}

/**
 * Merge runtime crawl into SoftwareGraph. Returns the same graph reference
 * when runtime has nothing usable.
 */
export function mergeRuntimeIntoSoftwareGraph(
  graph: SoftwareGraph,
  runtime: RuntimeCrawlLike | null | undefined,
): SoftwareGraph {
  if (!runtime || !Array.isArray(runtime.verifiedEdges) || runtime.verifiedEdges.length === 0) {
    return graph;
  }

  const nodes = [...graph.nodes];
  const edges = [...graph.edges];
  const edgeIds = new Set(edges.map((edge) => edge.id));
  let added = 0;

  for (const [index, verified] of runtime.verifiedEdges.entries()) {
    const fromRoute = findRouteNode(nodes, verified.sourceRoute);
    const toRoute = findRouteNode(nodes, verified.targetRoute ?? verified.targetPath);
    if (!fromRoute || !toRoute) continue;

    const edgeId = `edge:observed:${verified.fromScreenId}:${verified.toScreenId ?? index}`;
    if (edgeIds.has(edgeId)) continue;

    const edge: SoftwareGraphEdge = {
      id: edgeId,
      kind: "api",
      sourceId: fromRoute.id,
      targetId: toRoute.id,
      metadata: {
        provenance: "observed",
        runtimeType: verified.type,
        verification: verified.verification,
        crawledAt: runtime.crawledAt,
        sourceRoute: verified.sourceRoute,
        targetRoute: verified.targetRoute ?? verified.targetPath,
      },
    };
    edges.push(edge);
    edgeIds.add(edgeId);
    added += 1;

    fromRoute.metadata = {
      ...fromRoute.metadata,
      runtimeObserved: true,
      provenance: fromRoute.metadata.provenance ?? "static",
    };
    toRoute.metadata = {
      ...toRoute.metadata,
      runtimeObserved: true,
      provenance: toRoute.metadata.provenance ?? "static",
    };
  }

  if (added === 0) return graph;

  // Mark matching execution groups with observed timings when present.
  const groups = graph.groups.map((group) => {
    if (!group.id.startsWith("execution:")) return group;
    return {
      ...group,
      // Preserve group; UI checks edge metadata for observed provenance.
    };
  });

  return {
    ...graph,
    nodes,
    edges,
    groups,
    metrics: [
      ...graph.metrics.filter((metric) => metric.id !== "observed-edges"),
      { id: "observed-edges", name: "observed-edges", value: added },
      {
        id: "edges",
        name: "edges",
        value: edges.length,
      },
    ],
  };
}
