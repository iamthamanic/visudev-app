/**
 * Infrastructure capability coverage for honest empty states (PR-15).
 * Location: src/modules/blueprint/components/infrastructure/infrastructure-coverage.ts
 */

import {
  buildCapabilityCoverageReport,
  emptyStateFromCoverage,
  type CapabilityCoverageEntry,
  type CoverageSignals,
} from "../../../../../shared/scan-detector/application/capability-coverage.js";
import type { BlueprintData } from "../../types";

export function infrastructureCoverageSignals(
  blueprint: BlueprintData,
  infraNodeCount: number,
): CoverageSignals {
  const filesAnalyzed = blueprint.filesAnalyzed ?? 0;
  const totalFiles = blueprint.totalFiles;
  const truncated =
    blueprint.graph?.condensed === true ||
    (blueprint.truncation as { truncated?: boolean } | undefined)?.truncated === true ||
    (typeof totalFiles === "number" && filesAnalyzed > 0 && filesAnalyzed < totalFiles);
  return {
    projectId: blueprint.graph?.projectId ?? "unknown",
    analyzedAt: blueprint.graph?.analyzedAt ?? new Date(0).toISOString(),
    hasFacts: infraNodeCount > 0 || (Array.isArray(blueprint.facts) && blueprint.facts.length > 0),
    filesAnalyzed,
    filesDiscovered: totalFiles,
    transportCapped: truncated,
    limitedBy: truncated ? "budget" : null,
  };
}

export function infrastructureCoverageEntry(
  blueprint: BlueprintData,
  infraNodeCount: number,
): CapabilityCoverageEntry {
  const report = buildCapabilityCoverageReport(
    infrastructureCoverageSignals(blueprint, infraNodeCount),
  );
  const entry = report.capabilities.find((item) => item.capabilityId === "infrastructure");
  if (entry) return entry;
  return {
    capabilityId: "infrastructure",
    coverage: "UNAVAILABLE",
    detection: "UNKNOWN",
    reason: null,
    summaryDe: "infrastructure: Zustand unklar.",
  };
}

export function infrastructureEmptyCopy(
  blueprint: BlueprintData,
  infraNodeCount: number,
): ReturnType<typeof emptyStateFromCoverage> & { detection: string; summaryDe: string } {
  const entry = infrastructureCoverageEntry(blueprint, infraNodeCount);
  const empty = emptyStateFromCoverage(entry);
  return { ...empty, detection: entry.detection, summaryDe: entry.summaryDe };
}
