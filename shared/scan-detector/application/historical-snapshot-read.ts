/**
 * Stable historical snapshot read contract for Evolution (#327) / SDE-13.
 * Location: shared/scan-detector/application/historical-snapshot-read.ts
 */

import type { ScanCacheStore } from "../domain/cache/cache-store.js";
import type {
  HistoricalSnapshotQuery,
  HistoricalSnapshotRecord,
} from "../domain/snapshot/types.js";

const DEFAULT_LIMIT = 20;
const HARD_MAX_LIMIT = 100;

function clampLimit(limit: number | undefined): number {
  if (typeof limit !== "number" || !Number.isFinite(limit) || limit <= 0) {
    return DEFAULT_LIMIT;
  }
  return Math.min(Math.floor(limit), HARD_MAX_LIMIT);
}

/**
 * Read project-scoped historical engine snapshots from a cache store.
 * Returns at most `limit` records; when `commitShas` is provided, preserves
 * that order and skips missing SHAs (honest partial results).
 */
export async function readHistoricalSnapshots(
  store: ScanCacheStore,
  query: HistoricalSnapshotQuery,
): Promise<HistoricalSnapshotRecord[]> {
  const projectId = query.projectId.trim();
  if (!projectId) return [];

  const index = await store.list(projectId);
  const limit = clampLimit(query.limit);

  const selectedKeys: string[] = [];
  if (query.commitShas && query.commitShas.length > 0) {
    for (const sha of query.commitShas) {
      if (selectedKeys.length >= limit) break;
      const match = index.find((row) => row.commitSha === sha);
      if (match) selectedKeys.push(match.key);
    }
  } else {
    for (const row of index) {
      if (selectedKeys.length >= limit) break;
      selectedKeys.push(row.key);
    }
  }

  const records: HistoricalSnapshotRecord[] = [];
  for (const key of selectedKeys) {
    let entry;
    try {
      entry = await store.get(key);
    } catch {
      // Corrupted / unreadable entry → skip (treat as miss)
      continue;
    }
    if (!entry || entry.projectId !== projectId) continue;
    records.push({
      key: entry.key,
      projectId: entry.projectId,
      applicationScopeId: entry.applicationScopeId,
      commitSha: entry.repo.commitSha ?? "",
      ref: entry.repo.branch ?? "HEAD",
      dirtyFingerprint: entry.repo.dirtyFingerprint,
      analyzedAt: entry.snapshot.analyzedAt,
      versions: entry.versions,
      snapshot: entry.snapshot,
    });
  }

  return records;
}
