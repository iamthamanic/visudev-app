/**
 * Helpers for scanType=all parent-run orchestration.
 * Location: local-engine/src/lib/analysis-all.ts
 */

import type { AnalysisStatus, SupportedScanType } from "../types/api.types.js";

/** App Flow first so runtime-crawl can land before Blueprint merges it. */
export const ALL_SCAN_SEQUENCE: readonly SupportedScanType[] = [
  "appflow",
  "blueprint",
  "data",
] as const;

export function aggregateParentStatus(childStatuses: AnalysisStatus[]): AnalysisStatus {
  if (childStatuses.length === 0) return "queued";
  if (childStatuses.some((status) => status === "queued" || status === "running")) {
    return "running";
  }
  const successes = childStatuses.filter(
    (status) => status === "success" || status === "partial",
  ).length;
  if (successes === childStatuses.length) return "success";
  if (successes === 0) return "failed";
  return "partial";
}

export function isParentScanType(scanType: string): scanType is "all" {
  return scanType === "all";
}
