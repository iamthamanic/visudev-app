/**
 * Pure forward/reverse lineage queries over canonical DataLineageGraph (PR-22).
 * No inference — filters and paginates paths that already contain the anchor entity.
 * Location: src/modules/data/lib/data-lineage-navigation.ts
 */

import type {
  DataLineageGraph,
  DataLineagePath,
  LineageEntityRef,
  LineageHop,
} from "../../../../shared/data-lineage.types.js";

export const LINEAGE_DEFAULT_LIMIT = 50;

export interface LineageAnchor {
  /** Preferred: DataGraph / SoftwareGraph table entity id. */
  entityId: string;
  /** Fallback match when ids diverge across IRs (label/name only as filter key, never as join). */
  labels?: readonly string[];
}

export type LineageDirection = "forward" | "reverse";

export interface QueryLineagePathsInput {
  graph: DataLineageGraph | null | undefined;
  anchor: LineageAnchor;
  direction: LineageDirection;
  searchQuery?: string;
  limit?: number;
  offset?: number;
}

export interface QueryLineagePathsResult {
  paths: DataLineagePath[];
  total: number;
  truncated: boolean;
}

function refMatches(ref: LineageEntityRef, anchor: LineageAnchor): boolean {
  if (ref.layer !== "data-entity") return false;
  if (ref.entityId === anchor.entityId) return true;
  const labels = (anchor.labels || []).map((item) => item.toLowerCase()).filter(Boolean);
  if (labels.length === 0) return false;
  return labels.includes(ref.label.toLowerCase()) || labels.includes(ref.entityId.toLowerCase());
}

function pathTouchesAnchor(path: DataLineagePath, anchor: LineageAnchor): boolean {
  return path.hops.some((hop) => refMatches(hop.from, anchor) || refMatches(hop.to, anchor));
}

function firstAnchorHopIndex(path: DataLineagePath, anchor: LineageAnchor): number {
  for (let index = 0; index < path.hops.length; index += 1) {
    const hop = path.hops[index];
    if (refMatches(hop.from, anchor) || refMatches(hop.to, anchor)) return index;
  }
  return -1;
}

/** Slice hops for display: forward = from anchor to terminal; reverse = start through anchor. */
export function slicePathHops(
  path: DataLineagePath,
  anchor: LineageAnchor,
  direction: LineageDirection,
): LineageHop[] {
  const index = firstAnchorHopIndex(path, anchor);
  if (index < 0) return [];
  if (direction === "forward") {
    return path.hops.slice(index);
  }
  return path.hops.slice(0, index + 1);
}

function pathMatchesSearch(path: DataLineagePath, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (path.id.toLowerCase().includes(q)) return true;
  if ((path.truncationReason || "").toLowerCase().includes(q)) return true;
  return path.hops.some(
    (hop) =>
      hop.from.label.toLowerCase().includes(q) ||
      hop.to.label.toLowerCase().includes(q) ||
      hop.from.entityId.toLowerCase().includes(q) ||
      hop.to.entityId.toLowerCase().includes(q) ||
      hop.joinRuleId.toLowerCase().includes(q),
  );
}

export function queryLineagePaths(input: QueryLineagePathsInput): QueryLineagePathsResult {
  const limit = Math.max(1, input.limit ?? LINEAGE_DEFAULT_LIMIT);
  const offset = Math.max(0, input.offset ?? 0);
  const all = (input.graph?.paths || []).filter((path) => pathTouchesAnchor(path, input.anchor));
  const filtered = all.filter((path) => pathMatchesSearch(path, input.searchQuery || ""));
  const page = filtered.slice(offset, offset + limit);
  return {
    paths: page,
    total: filtered.length,
    truncated: offset + page.length < filtered.length,
  };
}
