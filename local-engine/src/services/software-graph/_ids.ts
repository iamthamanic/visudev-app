/**
 * Id generation and deduplication for the Software Graph builder.
 *
 * stableUniqueId returns the requested id if it has not been used yet.
 * If it already exists, it appends a deterministic counter suffix.
 */

import type { IdRegistry } from "./_types.js";

export function createId(prefix: string, ...parts: (string | number)[]): string {
  return `${prefix}:${parts.map((p) => String(p).replace(/[:\s]+/g, "-")).join(":")}`;
}

function suffix(id: string, counter: number): string {
  return `${id}~${counter}`;
}

export function stableUniqueId(
  registry: IdRegistry,
  kind: "node" | "edge" | "scope" | "evidence",
  id: string,
): string {
  const set =
    kind === "node"
      ? registry.nodes
      : kind === "edge"
        ? registry.edges
        : kind === "scope"
          ? registry.scopes
          : registry.evidence;
  if (!set.has(id)) {
    set.add(id);
    return id;
  }
  let counter = 1;
  let candidate = suffix(id, counter);
  while (set.has(candidate)) {
    counter += 1;
    candidate = suffix(id, counter);
  }
  set.add(candidate);
  return candidate;
}

/**
 * Registers a deterministic id that must not be renamed on collision.
 * Returns true when the id was newly registered.
 */
export function registerKnownId(
  registry: IdRegistry,
  kind: "node" | "edge" | "scope" | "evidence",
  id: string,
): boolean {
  const set =
    kind === "node"
      ? registry.nodes
      : kind === "edge"
        ? registry.edges
        : kind === "scope"
          ? registry.scopes
          : registry.evidence;
  if (set.has(id)) return false;
  set.add(id);
  return true;
}
