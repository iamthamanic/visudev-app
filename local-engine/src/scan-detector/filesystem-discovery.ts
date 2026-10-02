/**
 * Local filesystem ProjectCapabilities discovery adapter (SDE-04).
 * Reuses shared skip-dir / size / extension policy; never follows symlinks out of jail.
 * Location: local-engine/src/scan-detector/filesystem-discovery.ts
 */

import { readdirSync, realpathSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import {
  discoverProjectCapabilities,
  type DiscoveryPathEntry,
} from "../../../shared/scan-detector/application/discover-project-capabilities.js";
import {
  DISCOVERY_MAX_FILE_BYTES,
  DISCOVERY_SUPPORTED_EXTENSIONS,
  DISCOVERY_INVENTORY_ONLY_EXTENSIONS,
  extensionOf,
  isSkippedDiscoveryDirName,
} from "../../../shared/scan-detector/domain/discovery-policy.js";
import type { ProjectCapabilities } from "../../../shared/scan-detector/domain/project-capabilities.js";

export interface FilesystemDiscoveryOptions {
  projectId: string;
  rootDir: string;
  maxFiles?: number;
  maxFileBytes?: number;
}

function isInsideJail(jailReal: string, candidate: string): boolean {
  const rel = relative(jailReal, candidate);
  return rel === "" || (!rel.startsWith(`..${sep}`) && rel !== ".." && !rel.startsWith(".."));
}

/**
 * Walk inventory under rootDir without following symlinks / leaving containment.
 */
export function walkDiscoveryInventory(
  rootDir: string,
  options: { maxFiles?: number; maxFileBytes?: number } = {},
): DiscoveryPathEntry[] {
  const maxFiles = options.maxFiles ?? 4000;
  const maxFileBytes = options.maxFileBytes ?? DISCOVERY_MAX_FILE_BYTES;
  const rootReal = realpathSync(rootDir);
  const out: DiscoveryPathEntry[] = [];
  const stack: string[] = [rootReal];

  while (stack.length > 0 && out.length < maxFiles) {
    const current = stack.pop()!;
    let entries;
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (out.length >= maxFiles) break;
      const full = join(current, entry.name);
      // Skip symlink entries before isDirectory/isFile (those follow targets).
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        if (isSkippedDiscoveryDirName(entry.name)) continue;
        if (!isInsideJail(rootReal, full)) continue;
        stack.push(full);
        continue;
      }
      if (!entry.isFile()) continue;
      if (!isInsideJail(rootReal, full)) continue;
      const ext = extensionOf(entry.name);
      const interesting =
        DISCOVERY_SUPPORTED_EXTENSIONS.has(ext) || DISCOVERY_INVENTORY_ONLY_EXTENSIONS.has(ext);
      if (!interesting) continue;
      let sizeBytes = 0;
      try {
        sizeBytes = statSync(full).size;
      } catch {
        continue;
      }
      const rel = relative(rootReal, full).split(sep).join("/");
      out.push({ path: rel, sizeBytes: Math.min(sizeBytes, maxFileBytes + 1) });
    }
  }

  return out;
}

export function discoverProjectCapabilitiesFromFilesystem(
  options: FilesystemDiscoveryOptions,
): ProjectCapabilities {
  const inventory = walkDiscoveryInventory(options.rootDir, {
    maxFiles: options.maxFiles,
    maxFileBytes: options.maxFileBytes,
  });
  return discoverProjectCapabilities({
    projectId: options.projectId,
    paths: inventory,
    maxFileBytes: options.maxFileBytes ?? DISCOVERY_MAX_FILE_BYTES,
  });
}
