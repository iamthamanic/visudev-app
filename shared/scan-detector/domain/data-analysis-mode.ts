/**
 * Data analysis mode — SDE-15: engine is the only runtime authority.
 * Location: shared/scan-detector/domain/data-analysis-mode.ts
 */

export const DATA_ANALYSIS_MODES = ["engine"] as const;

export type DataAnalysisMode = (typeof DATA_ANALYSIS_MODES)[number];

/** Final cutover default (SDE-15). */
export const DEFAULT_DATA_ANALYSIS_MODE: DataAnalysisMode = "engine";

export function isDataAnalysisMode(value: unknown): value is DataAnalysisMode {
  return value === "engine";
}

/** Parse env / config string. Retired legacy/shadow values map to engine. */
export function parseDataAnalysisMode(raw: string | undefined | null): DataAnalysisMode {
  void raw;
  return DEFAULT_DATA_ANALYSIS_MODE;
}
