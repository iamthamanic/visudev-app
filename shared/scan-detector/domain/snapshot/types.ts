/**
 * Versioned snapshot / cache domain types (SDE-13).
 * Runtime-neutral — no Node/Deno/DOM imports.
 * Location: shared/scan-detector/domain/snapshot/types.ts
 */

import type { ScanRepoMetadata, ScanSnapshot, ScanVersionManifest } from "../../types.js";

/** Canonical parts that compose a stable snapshot cache key. */
export interface SnapshotKeyParts {
  projectId: string;
  /** Multi-app / monorepo application scope id; defaults to `_`. */
  applicationScopeId: string;
  /** Commit SHA when known; empty string when unavailable. */
  commitSha: string;
  /** Branch name, tag, or working-tree marker. */
  ref: string;
  /**
   * Dirty fingerprint: `clean` when the tree matches the commit,
   * otherwise a caller-provided digest of dirty status (+ optional path digests).
   */
  dirtyFingerprint: string;
  engineVersion: string;
  modelVersions: ScanVersionManifest["modelVersions"];
  detectorVersions: Record<string, string>;
}

export interface ScanCacheIndexEntry {
  key: string;
  projectId: string;
  applicationScopeId: string;
  commitSha: string;
  ref: string;
  dirtyFingerprint: string;
  analyzedAt: string;
  engineVersion: string;
}

export interface ScanCacheEntry {
  key: string;
  projectId: string;
  applicationScopeId: string;
  createdAt: string;
  versions: ScanVersionManifest;
  repo: ScanRepoMetadata & { dirtyFingerprint: string };
  /** Per-detector input fingerprints used for incremental reuse. */
  detectorInputFingerprints: Record<string, string>;
  /** Redacted engine snapshot — never secrets / raw DB samples. */
  snapshot: ScanSnapshot;
}

export type IncrementalDecision =
  | "cache-hit"
  | "rerun-input-changed"
  | "rerun-version-incompatible"
  | "rerun-missing"
  | "rerun-dependency";

export interface IncrementalPlan {
  cacheHitDetectorIds: string[];
  rerunDetectorIds: string[];
  reasonByDetector: Record<string, IncrementalDecision>;
}

export interface DetectorDependencyRule {
  detectorId: string;
  /** Path prefixes (repo-relative) that invalidate this detector when touched. */
  inputPathPrefixes: readonly string[];
  /** Sibling detector ids whose output this detector consumes. */
  dependsOnDetectorIds?: readonly string[];
}

export interface HistoricalSnapshotQuery {
  projectId: string;
  /** When set, only return entries matching these commit SHAs (order preserved). */
  commitShas?: readonly string[];
  /** Max records (default 20, hard max 100). */
  limit?: number;
}

export interface HistoricalSnapshotRecord {
  key: string;
  projectId: string;
  applicationScopeId: string;
  commitSha: string;
  ref: string;
  dirtyFingerprint: string;
  analyzedAt: string;
  versions: ScanVersionManifest;
  snapshot: ScanSnapshot;
}
