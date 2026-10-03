/**
 * AppFlow analysis mode — SDE-15: engine is the only runtime authority.
 * Location: shared/scan-detector/domain/appflow-analysis-mode.ts
 */

export const APPFLOW_ANALYSIS_MODES = ["engine"] as const;

export type AppflowAnalysisMode = (typeof APPFLOW_ANALYSIS_MODES)[number];

/** Final cutover default (SDE-15). */
export const DEFAULT_APPFLOW_ANALYSIS_MODE: AppflowAnalysisMode = "engine";

export function isAppflowAnalysisMode(value: unknown): value is AppflowAnalysisMode {
  return value === "engine";
}

/** Parse env / config string. Retired legacy/shadow values map to engine. */
export function parseAppflowAnalysisMode(raw: string | undefined | null): AppflowAnalysisMode {
  void raw;
  return DEFAULT_APPFLOW_ANALYSIS_MODE;
}
