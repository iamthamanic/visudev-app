/**
 * Segment parent-spread index for domain-vs-layer calibration (P0-13).
 * Location: local-engine/src/services/software-graph/_segment-spread.ts
 *
 * Pure measurement — does not decide domains. P0-10 applies the thresholds.
 */

import { normalizePath } from "./_heuristics.js";

/**
 * Calibrated 2026-08-12 against
 * visudev-test-repos/evidence/segment-spread-calibration-2026-08-12.md
 *
 * MAX_SPREAD_FOR_DOMAIN: domain folders (leaves/payroll/accounts) typically
 * appear under one parent; layer folders (models/controllers) recur under many.
 * MIN_SIBLING_DOMAINS: a domain candidate should sit beside at least this many
 * sibling directories (self included) under that parent.
 */
export const MAX_SPREAD_FOR_DOMAIN = 2;
export const MIN_SIBLING_DOMAINS = 3;

export interface SegmentSpreadEntry {
  /** Lowercase key used for aggregation. */
  key: string;
  /** Most frequent original spelling. */
  label: string;
  /** Number of distinct parent directories this segment appears under. */
  parentSpread: number;
  /** Median sibling directory count across those parents. */
  medianSiblings: number;
  /** How many files sit under a path that includes this segment. */
  fileCount: number;
}

export interface SegmentSpreadIndex {
  byKey: Map<string, SegmentSpreadEntry>;
  fileCount: number;
}

/**
 * True when spread/sibling stats look like a domain folder, not a repeated layer.
 * `minSiblings - 1` because “at least N domain siblings” means N−1 others plus self.
 */
export function isDomainCandidate(
  entry: SegmentSpreadEntry,
  maxSpread: number = MAX_SPREAD_FOR_DOMAIN,
  minSiblings: number = MIN_SIBLING_DOMAINS,
): boolean {
  return entry.parentSpread <= maxSpread && entry.medianSiblings >= minSiblings - 1;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid] ?? 0;
  return ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
}

function modeLabel(spellings: Map<string, number>): string {
  let best = "";
  let bestCount = -1;
  for (const [spelling, count] of spellings) {
    if (count > bestCount || (count === bestCount && spelling.localeCompare(best) < 0)) {
      best = spelling;
      bestCount = count;
    }
  }
  return best;
}

/**
 * Build parent-spread / sibling stats for every directory segment in `filePaths`
 * (filename segment excluded). Keys are case-folded; labels keep the mode spelling.
 */
export function buildSegmentSpreadIndex(filePaths: readonly string[]): SegmentSpreadIndex {
  /** parentPath → set of child directory names (original casing) */
  const childrenByParent = new Map<string, Map<string, string>>();
  /** key → label spellings */
  const labels = new Map<string, Map<string, number>>();
  /** key → set of parent paths */
  const parentsByKey = new Map<string, Set<string>>();
  /** key → file count */
  const fileCounts = new Map<string, number>();

  for (const raw of filePaths) {
    const normalized = normalizePath(raw).replace(/\\/g, "/");
    if (!normalized) continue;
    const parts = normalized.split("/").filter(Boolean);
    if (parts.length < 2) continue;

    // Exclude filename (last segment).
    const dirParts = parts.slice(0, -1);
    const keysInFile = new Set<string>();

    for (let i = 0; i < dirParts.length; i += 1) {
      const label = dirParts[i] ?? "";
      if (!label) continue;
      const key = label.toLowerCase();
      const parent = dirParts.slice(0, i).join("/");

      if (!childrenByParent.has(parent)) childrenByParent.set(parent, new Map());
      childrenByParent.get(parent)!.set(key, label);

      if (!parentsByKey.has(key)) parentsByKey.set(key, new Set());
      parentsByKey.get(key)!.add(parent);

      if (!labels.has(key)) labels.set(key, new Map());
      const spelling = labels.get(key)!;
      spelling.set(label, (spelling.get(label) ?? 0) + 1);

      keysInFile.add(key);
    }

    for (const key of keysInFile) {
      fileCounts.set(key, (fileCounts.get(key) ?? 0) + 1);
    }
  }

  const byKey = new Map<string, SegmentSpreadEntry>();
  for (const [key, parents] of parentsByKey) {
    const siblingCounts: number[] = [];
    for (const parent of parents) {
      const children = childrenByParent.get(parent);
      const childCount = children?.size ?? 0;
      // Other siblings only (exclude self).
      siblingCounts.push(Math.max(0, childCount - 1));
    }
    byKey.set(key, {
      key,
      label: modeLabel(labels.get(key) ?? new Map([[key, 1]])),
      parentSpread: parents.size,
      medianSiblings: median(siblingCounts),
      fileCount: fileCounts.get(key) ?? 0,
    });
  }

  return { byKey, fileCount: filePaths.length };
}
