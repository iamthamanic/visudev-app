/**
 * Incremental invalidation / dependency planning (SDE-13).
 * Location: shared/scan-detector/domain/snapshot/invalidation.ts
 */

import type { ScanVersionManifest } from "../../types.js";
import { isDetectorVersionCompatible } from "./compatibility.js";
import type {
  DetectorDependencyRule,
  IncrementalDecision,
  IncrementalPlan,
  ScanCacheEntry,
} from "./types.js";

const DEFAULT_RULES: readonly DetectorDependencyRule[] = [
  {
    detectorId: "static-blueprint",
    inputPathPrefixes: ["src/", "app/", "pages/", "lib/", "shared/", "packages/"],
  },
  {
    detectorId: "web-ui",
    inputPathPrefixes: ["src/", "app/", "pages/", "components/"],
    dependsOnDetectorIds: ["static-blueprint"],
  },
  {
    detectorId: "runtime-observer",
    inputPathPrefixes: [],
    dependsOnDetectorIds: ["web-ui"],
  },
  {
    detectorId: "schema-data",
    inputPathPrefixes: ["prisma/", "supabase/", "migrations/", "drizzle/", "db/"],
  },
];

function pathMatchesPrefix(path: string, prefix: string): boolean {
  const normalized = path.replace(/\\/g, "/").replace(/^\.\//, "");
  const normalizedPrefix = prefix.replace(/\\/g, "/");
  return normalized === normalizedPrefix || normalized.startsWith(normalizedPrefix);
}

export function ruleForDetector(
  detectorId: string,
  rules: readonly DetectorDependencyRule[] = DEFAULT_RULES,
): DetectorDependencyRule | undefined {
  return rules.find((rule) => rule.detectorId === detectorId);
}

/** True when any changed path matches the detector's input prefixes. */
export function detectorInvalidatedByPaths(
  detectorId: string,
  changedPaths: readonly string[],
  rules: readonly DetectorDependencyRule[] = DEFAULT_RULES,
): boolean {
  const rule = ruleForDetector(detectorId, rules);
  if (!rule) {
    // Unknown detector: conservative invalidate when any path changed
    return changedPaths.length > 0;
  }
  if (rule.inputPathPrefixes.length === 0) {
    return false;
  }
  return changedPaths.some((path) =>
    rule.inputPathPrefixes.some((prefix) => pathMatchesPrefix(path, prefix)),
  );
}

export interface PlanIncrementalScanInput {
  previous: ScanCacheEntry | null;
  requestedDetectorIds: readonly string[];
  currentInputFingerprints: Record<string, string>;
  currentVersions: ScanVersionManifest;
  changedPaths?: readonly string[];
  rules?: readonly DetectorDependencyRule[];
}

/**
 * Decide per detector whether cached facts may be reused.
 * Deterministic: same inputs → same plan.
 */
export function planIncrementalScan(input: PlanIncrementalScanInput): IncrementalPlan {
  const rules = input.rules ?? DEFAULT_RULES;
  const reasonByDetector: Record<string, IncrementalDecision> = {};
  const cacheHitDetectorIds: string[] = [];
  const rerunDetectorIds: string[] = [];

  const previous = input.previous;
  const changedPaths = input.changedPaths ?? [];

  for (const detectorId of input.requestedDetectorIds) {
    if (!previous) {
      reasonByDetector[detectorId] = "rerun-missing";
      rerunDetectorIds.push(detectorId);
      continue;
    }

    if (!isDetectorVersionCompatible(previous.versions, input.currentVersions, detectorId)) {
      reasonByDetector[detectorId] = "rerun-version-incompatible";
      rerunDetectorIds.push(detectorId);
      continue;
    }

    const prevFp = previous.detectorInputFingerprints[detectorId];
    const nextFp = input.currentInputFingerprints[detectorId];
    if (!prevFp || !nextFp || prevFp !== nextFp) {
      reasonByDetector[detectorId] = "rerun-input-changed";
      rerunDetectorIds.push(detectorId);
      continue;
    }

    if (changedPaths.length > 0 && detectorInvalidatedByPaths(detectorId, changedPaths, rules)) {
      reasonByDetector[detectorId] = "rerun-input-changed";
      rerunDetectorIds.push(detectorId);
      continue;
    }

    reasonByDetector[detectorId] = "cache-hit";
    cacheHitDetectorIds.push(detectorId);
  }

  // Dependency cascade: if a dependency reruns, dependents must rerun too
  let changed = true;
  while (changed) {
    changed = false;
    for (const detectorId of input.requestedDetectorIds) {
      if (reasonByDetector[detectorId] !== "cache-hit") continue;
      const rule = ruleForDetector(detectorId, rules);
      const deps = rule?.dependsOnDetectorIds ?? [];
      const depNeedsRerun = deps.some((depId) => {
        const reason = reasonByDetector[depId];
        // Only cascade when the dependency was part of this plan and will rerun.
        return typeof reason === "string" && reason !== "cache-hit";
      });
      if (depNeedsRerun) {
        reasonByDetector[detectorId] = "rerun-dependency";
        const hitIndex = cacheHitDetectorIds.indexOf(detectorId);
        if (hitIndex >= 0) cacheHitDetectorIds.splice(hitIndex, 1);
        if (!rerunDetectorIds.includes(detectorId)) rerunDetectorIds.push(detectorId);
        changed = true;
      }
    }
  }

  return { cacheHitDetectorIds, rerunDetectorIds, reasonByDetector };
}

export { DEFAULT_RULES as DEFAULT_DETECTOR_DEPENDENCY_RULES };
