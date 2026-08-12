/**
 * Mutable builder state and limit-aware add helpers.
 */

import type {
  SoftwareGraphEdge,
  SoftwareGraphNode,
  SoftwareGraphScope,
} from "../../types/api.types.js";
import { stableUniqueId } from "./_ids.js";
import type { SegmentSpreadIndex } from "./_segment-spread.js";
import type { IdRegistry } from "./_types.js";

export interface GraphBuilderState {
  scopes: Map<string, SoftwareGraphScope>;
  nodes: Map<string, SoftwareGraphNode>;
  edges: Map<string, SoftwareGraphEdge>;
  evidence: import("../../types/api.types.js").SoftwareGraphEvidence[];
  registry: IdRegistry;
  nodeCount: number;
  edgeCount: number;
  attemptedNodes: number;
  attemptedEdges: number;
  condensed: boolean;
  /** Built once per scan (P0-10); absent → legacy first-segment domains. */
  segmentSpread?: SegmentSpreadIndex;
}

export const DEFAULT_LIMITS = { maxNodes: 2500, maxEdges: 5000 };

export function createBuilderState(): GraphBuilderState {
  return {
    scopes: new Map(),
    nodes: new Map(),
    edges: new Map(),
    evidence: [],
    registry: { nodes: new Set(), edges: new Set(), scopes: new Set(), evidence: new Set() },
    nodeCount: 0,
    edgeCount: 0,
    attemptedNodes: 0,
    attemptedEdges: 0,
    condensed: false,
  };
}

function canAddNode(state: GraphBuilderState): boolean {
  if (state.condensed) return false;
  if (state.attemptedNodes >= DEFAULT_LIMITS.maxNodes) {
    state.condensed = true;
    return false;
  }
  return true;
}

function canAddEdge(state: GraphBuilderState): boolean {
  if (state.condensed) return false;
  if (state.attemptedEdges >= DEFAULT_LIMITS.maxEdges) {
    state.condensed = true;
    return false;
  }
  return true;
}

export function addNode(state: GraphBuilderState, node: SoftwareGraphNode): void {
  state.attemptedNodes += 1;
  if (!canAddNode(state)) return;
  state.nodes.set(node.id, node);
  state.nodeCount += 1;
}

export function addEdge(state: GraphBuilderState, edge: SoftwareGraphEdge): void {
  state.attemptedEdges += 1;
  if (!canAddEdge(state)) return;
  state.edges.set(edge.id, edge);
  state.edgeCount += 1;
}

/**
 * Prefer critical edges (e.g. leave→LeaveRequest) even when node-cap set `condensed`.
 * Still respects maxEdges and skips duplicates.
 */
export function addEdgePrefer(state: GraphBuilderState, edge: SoftwareGraphEdge): void {
  state.attemptedEdges += 1;
  if (state.edges.has(edge.id)) return;
  if (state.edgeCount >= DEFAULT_LIMITS.maxEdges) {
    state.condensed = true;
    return;
  }
  state.edges.set(edge.id, edge);
  state.edgeCount += 1;
}

/**
 * Prefer critical nodes (infra engines) even when soft node-cap set `condensed`.
 * Still respects maxNodes and skips duplicates.
 */
export function addNodePrefer(state: GraphBuilderState, node: SoftwareGraphNode): void {
  state.attemptedNodes += 1;
  if (state.nodes.has(node.id)) return;
  if (state.nodeCount >= DEFAULT_LIMITS.maxNodes) {
    state.condensed = true;
    return;
  }
  state.nodes.set(node.id, node);
  state.nodeCount += 1;
}

export function addScope(state: GraphBuilderState, scope: SoftwareGraphScope): void {
  if (!state.scopes.has(scope.id)) {
    state.scopes.set(scope.id, scope);
  }
}

export function registerRootScope(state: GraphBuilderState, scope: SoftwareGraphScope): void {
  stableUniqueId(state.registry, "scope", scope.id);
  addScope(state, scope);
}
