/**
 * Local filesystem ScanCacheStore (SDE-13).
 * Project-scoped JSON files under a caller-provided root directory.
 * Location: local-engine/src/scan-detector/local-fs-cache-store.ts
 */

import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, unlink, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { ScanCacheStore } from "../../../shared/scan-detector/domain/cache/cache-store.js";
import type {
  ScanCacheEntry,
  ScanCacheIndexEntry,
} from "../../../shared/scan-detector/domain/snapshot/types.js";

function assertSafeRoot(rootDir: string): string {
  const resolved = resolve(rootDir);
  if (resolved.includes("\0")) {
    throw new Error("Invalid cache root");
  }
  return resolved;
}

function fileNameForKey(key: string): string {
  const digest = createHash("sha256").update(key).digest("hex").slice(0, 32);
  return `${digest}.json`;
}

function isScanCacheEntry(value: unknown): value is ScanCacheEntry {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.key === "string" &&
    typeof record.projectId === "string" &&
    typeof record.applicationScopeId === "string" &&
    typeof record.createdAt === "string" &&
    typeof record.versions === "object" &&
    record.versions !== null &&
    typeof record.snapshot === "object" &&
    record.snapshot !== null
  );
}

export class LocalFsScanCacheStore implements ScanCacheStore {
  private readonly rootDir: string;

  constructor(rootDir: string) {
    this.rootDir = assertSafeRoot(rootDir);
  }

  private async ensureRoot(): Promise<void> {
    await mkdir(this.rootDir, { recursive: true });
  }

  private pathForKey(key: string): string {
    return join(this.rootDir, fileNameForKey(key));
  }

  async get(key: string): Promise<ScanCacheEntry | null> {
    try {
      const raw = await readFile(this.pathForKey(key), "utf8");
      const parsed: unknown = JSON.parse(raw);
      if (!isScanCacheEntry(parsed)) return null;
      if (parsed.key !== key) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  async put(entry: ScanCacheEntry): Promise<void> {
    await this.ensureRoot();
    const target = this.pathForKey(entry.key);
    const payload = `${JSON.stringify(entry)}\n`;
    await writeFile(target, payload, "utf8");
  }

  async delete(key: string): Promise<void> {
    try {
      await unlink(this.pathForKey(key));
    } catch {
      // missing is fine
    }
  }

  async list(projectId: string): Promise<ScanCacheIndexEntry[]> {
    try {
      await this.ensureRoot();
      const names = await readdir(this.rootDir);
      const rows: ScanCacheIndexEntry[] = [];
      for (const name of names) {
        if (!name.endsWith(".json")) continue;
        try {
          const raw = await readFile(join(this.rootDir, name), "utf8");
          const parsed: unknown = JSON.parse(raw);
          if (!isScanCacheEntry(parsed)) continue;
          if (parsed.projectId !== projectId) continue;
          rows.push({
            key: parsed.key,
            projectId: parsed.projectId,
            applicationScopeId: parsed.applicationScopeId,
            commitSha: parsed.repo.commitSha ?? "",
            ref: parsed.repo.branch ?? "HEAD",
            dirtyFingerprint: parsed.repo.dirtyFingerprint,
            analyzedAt: parsed.snapshot.analyzedAt,
            engineVersion: parsed.versions.engineVersion,
          });
        } catch {
          // corrupted file → skip
        }
      }
      rows.sort((a, b) => (a.analyzedAt < b.analyzedAt ? 1 : a.analyzedAt > b.analyzedAt ? -1 : 0));
      return rows;
    } catch {
      return [];
    }
  }
}
