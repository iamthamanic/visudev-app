/**
 * Scan cache store port (SDE-13).
 * Runtime-neutral interface — Local FS adapter lives in local-engine.
 * Location: shared/scan-detector/domain/cache/cache-store.ts
 */

import type { ScanCacheEntry, ScanCacheIndexEntry } from "../snapshot/types.js";

export interface ScanCacheStore {
  get(key: string): Promise<ScanCacheEntry | null>;
  put(entry: ScanCacheEntry): Promise<void>;
  delete(key: string): Promise<void>;
  /** Project-scoped index for historical reads (#327). */
  list(projectId: string): Promise<ScanCacheIndexEntry[]>;
}
