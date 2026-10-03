/**
 * Deterministic snapshot cache key builder (SDE-13).
 * Location: shared/scan-detector/domain/snapshot/snapshot-key.ts
 */

import type { SnapshotKeyParts } from "./types.js";

const KEY_PREFIX = "sde-snap:v1";

function normalizeSegment(value: string | undefined | null, fallback: string): string {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return fallback;
  // Keep keys path-safe and delimiter-safe.
  return trimmed.replace(/[|\n\r]/g, "_");
}

function sortedPairString(record: Record<string, string | undefined>): string {
  const pairs = Object.entries(record)
    .filter(
      (entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].length > 0,
    )
    .map(([key, value]) => `${normalizeSegment(key, "_")}=${normalizeSegment(value, "_")}`)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return pairs.length === 0 ? "_" : pairs.join(",");
}

/**
 * Build a stable, comparable snapshot key from scope + ref + dirty + versions.
 * Format: sde-snap:v1|project|scope|commit|ref|dirty|engine|models|detectors
 */
export function buildSnapshotKey(parts: SnapshotKeyParts): string {
  const projectId = normalizeSegment(parts.projectId, "_");
  const scope = normalizeSegment(parts.applicationScopeId, "_");
  const commit = normalizeSegment(parts.commitSha, "nocommit");
  const ref = normalizeSegment(parts.ref, "HEAD");
  const dirty = normalizeSegment(parts.dirtyFingerprint, "unknown");
  const engine = normalizeSegment(parts.engineVersion, "0");
  const models = sortedPairString({
    softwareGraph: parts.modelVersions.softwareGraph,
    semanticSystemModel: parts.modelVersions.semanticSystemModel,
    uiInteractionGraph: parts.modelVersions.uiInteractionGraph,
    dataGraph: parts.modelVersions.dataGraph,
  });
  const detectors = sortedPairString(parts.detectorVersions);

  return [KEY_PREFIX, projectId, scope, commit, ref, dirty, engine, models, detectors].join("|");
}

/** Parse projectId from a key produced by {@link buildSnapshotKey}; null if malformed. */
export function projectIdFromSnapshotKey(key: string): string | null {
  if (!key.startsWith(`${KEY_PREFIX}|`)) return null;
  const parts = key.split("|");
  if (parts.length < 9) return null;
  return parts[1] || null;
}

/**
 * Lightweight deterministic fingerprint over ordered path+digest pairs.
 * Callers supply digests (e.g. from git or content hashes); this only mixes them.
 */
export function fingerprintFromPathDigests(
  entries: readonly { path: string; digest: string }[],
): string {
  if (entries.length === 0) return "empty";
  const sorted = [...entries].sort((a, b) =>
    a.path < b.path
      ? -1
      : a.path > b.path
        ? 1
        : a.digest < b.digest
          ? -1
          : a.digest > b.digest
            ? 1
            : 0,
  );
  let hash = 2166136261;
  for (const entry of sorted) {
    const token = `${entry.path}\0${entry.digest}\n`;
    for (let i = 0; i < token.length; i += 1) {
      hash ^= token.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
  }
  // Unsigned 32-bit hex
  return `fnv1a:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function dirtyFingerprintForCleanTree(): string {
  return "clean";
}
