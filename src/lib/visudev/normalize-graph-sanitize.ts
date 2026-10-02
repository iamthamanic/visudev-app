import type { SoftwareGraphEdge, SoftwareGraphNode } from "./software-graph-types";
import { boundedString, exactString, MAX_STRING_LEN } from "./normalize-graph-guards";

const MAX_METADATA_KEYS_SCAN = 64;
const MAX_METADATA_KEYS_KEEP = 32;
const ALLOWED_METADATA_KEYS = new Set([
  "runtime",
  "framework",
  "language",
  "routeId",
  "method",
  "path",
  "pipelineCount",
  "executionStatus",
  "status",
  "traceId",
  "durationMs",
  "port",
  "ports",
  "tier",
  "env",
  "region",
  "instances",
  "type",
  "technology",
  "version",
  "kind",
  // RVP-9 / SDE infrastructure projection markers
  "infrastructure",
  "source",
  "networks",
  "runtimeObserved",
  "runtimeStatus",
  "live",
  "deploymentUnitId",
]);

function positiveLine(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1;
}

export function sanitizeMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  let scanned = 0;
  let kept = 0;

  for (const key in metadata) {
    if (!Object.prototype.hasOwnProperty.call(metadata, key)) continue;
    scanned += 1;
    if (scanned > MAX_METADATA_KEYS_SCAN || kept >= MAX_METADATA_KEYS_KEEP) break;

    const safeKey = boundedString(key, 64);
    if (!safeKey || !ALLOWED_METADATA_KEYS.has(safeKey)) continue;
    const value = metadata[key];
    if (typeof value === "string") {
      output[safeKey] = boundedString(value, MAX_STRING_LEN) ?? value.slice(0, MAX_STRING_LEN);
      kept += 1;
    } else if (typeof value === "number" && Number.isFinite(value)) {
      output[safeKey] = value;
      kept += 1;
    } else if (typeof value === "boolean") {
      output[safeKey] = value;
      kept += 1;
    }
  }

  return output;
}

export function sanitizeNode(node: SoftwareGraphNode): SoftwareGraphNode | null {
  const id = exactString(node.id);
  const label = boundedString(node.label);
  if (!id || !label) return null;
  return {
    id,
    kind: node.kind,
    label,
    scopeId: node.scopeId ? exactString(node.scopeId) : undefined,
    filePath: node.filePath ? boundedString(node.filePath, 512) : undefined,
    line: positiveLine(node.line) ? node.line : undefined,
    metadata: sanitizeMetadata(node.metadata),
  };
}

export function sanitizeEdge(edge: SoftwareGraphEdge): SoftwareGraphEdge | null {
  const id = exactString(edge.id);
  const sourceId = exactString(edge.sourceId);
  const targetId = exactString(edge.targetId);
  if (!id || !sourceId || !targetId) return null;
  return {
    id,
    kind: edge.kind,
    sourceId,
    targetId,
    metadata: sanitizeMetadata(edge.metadata),
  };
}
