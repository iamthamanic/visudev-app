/**
 * Graph ↔ Code selection mapping (Honest-Core P1-5).
 * Location: src/modules/blueprint/selection.ts
 */

import type { SoftwareGraphNode } from "./types.js";

export type GraphCodeOrigin = "graph" | "code";

export const HINT_NO_FILE = "Keine Datei — externer Service";
export const HINT_UNKNOWN_LINE = "Zeile unbekannt";
export const HINT_NO_NODE = "Kein Knoten für diese Datei";

export interface GraphCodeSelection {
  nodeId: string | null;
  filePath: string | null;
  line: number | null;
  origin: GraphCodeOrigin;
  relatedNodeIds: string[];
  hint: string | null;
}

function readNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readPositiveLine(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 1) return null;
  return value;
}

export function readGraphNodeFilePath(node: SoftwareGraphNode): string | null {
  return readNonEmptyString(node.filePath) ?? readNonEmptyString(node.metadata?.filePath);
}

export function readGraphNodeLine(node: SoftwareGraphNode): number | null {
  return readPositiveLine(node.line) ?? readPositiveLine(node.metadata?.line);
}

export function findNodeIdsByFilePath(
  nodes: readonly SoftwareGraphNode[],
  filePath: string,
): string[] {
  return nodes.filter((node) => readGraphNodeFilePath(node) === filePath).map((node) => node.id);
}

export function selectionFromNode(
  node: SoftwareGraphNode,
  nodes: readonly SoftwareGraphNode[],
  origin: GraphCodeOrigin = "graph",
): GraphCodeSelection {
  const filePath = readGraphNodeFilePath(node);
  const line = readGraphNodeLine(node);
  if (!filePath) {
    return {
      nodeId: node.id,
      filePath: null,
      line: null,
      origin,
      relatedNodeIds: [node.id],
      hint: HINT_NO_FILE,
    };
  }
  return {
    nodeId: node.id,
    filePath,
    line,
    origin,
    relatedNodeIds: findNodeIdsByFilePath(nodes, filePath),
    hint: line == null ? HINT_UNKNOWN_LINE : null,
  };
}

export function selectionFromCode(
  filePath: string,
  line: number | null,
  nodes: readonly SoftwareGraphNode[],
): GraphCodeSelection {
  const relatedNodeIds = findNodeIdsByFilePath(nodes, filePath);
  if (relatedNodeIds.length === 0) {
    return {
      nodeId: null,
      filePath,
      line,
      origin: "code",
      relatedNodeIds: [],
      hint: HINT_NO_NODE,
    };
  }
  const lineMatch =
    line == null
      ? null
      : nodes.find((node) => relatedNodeIds.includes(node.id) && readGraphNodeLine(node) === line);
  return {
    nodeId: lineMatch?.id ?? relatedNodeIds[0],
    filePath,
    line,
    origin: "code",
    relatedNodeIds,
    hint: line == null ? HINT_UNKNOWN_LINE : null,
  };
}
