/**
 * Data analysis mode contract for SDE-12 cutover (legacy | shadow | engine).
 * Location: shared/scan-detector/domain/data-analysis-mode.ts
 */

export const DATA_ANALYSIS_MODES = ["legacy", "shadow", "engine"] as const;

export type DataAnalysisMode = (typeof DATA_ANALYSIS_MODES)[number];

export const DEFAULT_DATA_ANALYSIS_MODE: DataAnalysisMode = "shadow";

export function isDataAnalysisMode(value: unknown): value is DataAnalysisMode {
  return value === "legacy" || value === "shadow" || value === "engine";
}

export function parseDataAnalysisMode(raw: string | undefined | null): DataAnalysisMode {
  if (raw == null) return DEFAULT_DATA_ANALYSIS_MODE;
  const trimmed = raw.trim().toLowerCase();
  if (trimmed.length === 0) return DEFAULT_DATA_ANALYSIS_MODE;
  if (isDataAnalysisMode(trimmed)) return trimmed;
  return DEFAULT_DATA_ANALYSIS_MODE;
}
