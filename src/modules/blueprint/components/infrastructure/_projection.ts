/**
 * Maps SoftwareGraph infrastructure entities into the smaller edge set used by
 * InfrastructureView (RVP-9: deployment/runtime/data/external only).
 * Location: src/modules/blueprint/components/infrastructure/_projection.ts
 */

import type {
  GraphCanvasEdge,
  GraphCanvasNode,
  SoftwareGraph,
  SoftwareGraphNode,
} from "../../types";
import type { SemanticSystemModel } from "../../../../../shared/semantic-system-model.types.js";
import { getNodeKindColor } from "./_colors.js";
import { selectInfrastructureNodes } from "./infrastructure-entities.js";

const INFRA_ID_PREFIX = "infra:v1:";

interface InfrastructureGraph {
  nodes: GraphCanvasNode[];
  edges: GraphCanvasEdge[];
}

function infraProjectedEdgeId(edgeId: string): string {
  return `${INFRA_ID_PREFIX}edge:${edgeId}`;
}

function reserveNodeId(nodeIds: Set<string>, node: GraphCanvasNode): boolean {
  if (nodeIds.has(node.id)) return false;
  nodeIds.add(node.id);
  return true;
}

function reserveEdgeId(edgeIds: Set<string>, edge: GraphCanvasEdge): boolean {
  if (edgeIds.has(edge.id)) return false;
  edgeIds.add(edge.id);
  return true;
}

function toCanvasNode(graphNode: SoftwareGraphNode): GraphCanvasNode {
  return {
    id: graphNode.id,
    label: graphNode.label,
    kind: graphNode.kind,
    color: getNodeKindColor(graphNode.kind),
  };
}

/**
 * Project only evidenced infrastructure entities.
 * Does not synthesize browser/edge/shared runtimes from file metadata.
 * Does not project files or routes.
 */
export function projectInfrastructureGraph(
  graph: SoftwareGraph,
  semantic?: SemanticSystemModel | null,
): InfrastructureGraph {
  const infraNodes = selectInfrastructureNodes(graph, semantic);
  const infraIdSet = new Set(infraNodes.map((node) => node.id));
  const nodeById = new Map(infraNodes.map((node) => [node.id, node]));
  const graphEdgeIds = new Set((Array.isArray(graph.edges) ? graph.edges : []).map((e) => e.id));

  const nodes: GraphCanvasNode[] = [];
  const edges: GraphCanvasEdge[] = [];
  const reservedNodeIds = new Set<string>();
  const reservedEdgeIds = new Set<string>();

  for (const graphNode of infraNodes) {
    const projected = toCanvasNode(graphNode);
    if (reserveNodeId(reservedNodeIds, projected)) {
      nodes.push(projected);
    }
  }

  for (const graphEdge of Array.isArray(graph.edges) ? graph.edges : []) {
    if (
      graphEdge.kind !== "external-dependency" &&
      graphEdge.kind !== "data" &&
      graphEdge.kind !== "contains"
    ) {
      continue;
    }
    if (!infraIdSet.has(graphEdge.sourceId) || !infraIdSet.has(graphEdge.targetId)) continue;
    if (!nodeById.has(graphEdge.sourceId) || !nodeById.has(graphEdge.targetId)) continue;

    const projectedEdge: GraphCanvasEdge = {
      id: infraProjectedEdgeId(graphEdge.id),
      source: graphEdge.sourceId,
      target: graphEdge.targetId,
      label:
        graphEdge.kind === "data"
          ? "stores-in"
          : graphEdge.kind === "contains"
            ? "deploys"
            : "external-dependency",
      kind: graphEdge.kind,
    };
    if (graphEdgeIds.has(projectedEdge.id)) continue;
    if (
      reservedNodeIds.has(projectedEdge.source) &&
      reservedNodeIds.has(projectedEdge.target) &&
      reserveEdgeId(reservedEdgeIds, projectedEdge)
    ) {
      edges.push(projectedEdge);
    }
  }

  return { nodes, edges };
}
