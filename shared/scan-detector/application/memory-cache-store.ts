/**
 * In-memory ScanCacheStore for tests and ephemeral Local sessions (SDE-13).
 * Location: shared/scan-detector/application/memory-cache-store.ts
 */

import type { ScanCacheStore } from "../domain/cache/cache-store.js";
import type { ScanCacheEntry, ScanCacheIndexEntry } from "../domain/snapshot/types.js";

function cloneEntry(entry: ScanCacheEntry): ScanCacheEntry {
  return {
    ...entry,
    versions: {
      engineVersion: entry.versions.engineVersion,
      modelVersions: { ...entry.versions.modelVersions },
      detectorVersions: { ...entry.versions.detectorVersions },
    },
    repo: { ...entry.repo },
    detectorInputFingerprints: { ...entry.detectorInputFingerprints },
    snapshot: {
      ...entry.snapshot,
      repo: { ...entry.snapshot.repo },
      versions: {
        engineVersion: entry.snapshot.versions.engineVersion,
        modelVersions: { ...entry.snapshot.versions.modelVersions },
        detectorVersions: { ...entry.snapshot.versions.detectorVersions },
      },
      capabilities: [...entry.snapshot.capabilities],
      facts: [...entry.snapshot.facts],
      evidence: [...entry.snapshot.evidence],
    },
  };
}

export class MemoryScanCacheStore implements ScanCacheStore {
  private readonly entries = new Map<string, ScanCacheEntry>();

  async get(key: string): Promise<ScanCacheEntry | null> {
    const entry = this.entries.get(key);
    return entry ? cloneEntry(entry) : null;
  }

  async put(entry: ScanCacheEntry): Promise<void> {
    this.entries.set(entry.key, cloneEntry(entry));
  }

  async delete(key: string): Promise<void> {
    this.entries.delete(key);
  }

  async list(projectId: string): Promise<ScanCacheIndexEntry[]> {
    const rows: ScanCacheIndexEntry[] = [];
    for (const entry of this.entries.values()) {
      if (entry.projectId !== projectId) continue;
      rows.push({
        key: entry.key,
        projectId: entry.projectId,
        applicationScopeId: entry.applicationScopeId,
        commitSha: entry.repo.commitSha ?? "",
        ref: entry.repo.branch ?? "HEAD",
        dirtyFingerprint: entry.repo.dirtyFingerprint,
        analyzedAt: entry.snapshot.analyzedAt,
        engineVersion: entry.versions.engineVersion,
      });
    }
    rows.sort((a, b) => (a.analyzedAt < b.analyzedAt ? 1 : a.analyzedAt > b.analyzedAt ? -1 : 0));
    return rows;
  }
}
