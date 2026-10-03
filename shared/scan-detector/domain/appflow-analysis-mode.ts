/**
 * AppFlow analysis mode contract for SDE-11 cutover (legacy | shadow | engine).
 * Location: shared/scan-detector/domain/appflow-analysis-mode.ts
 */

export const APPFLOW_ANALYSIS_MODES = ["legacy", "shadow", "engine"] as const;

export type AppflowAnalysisMode = (typeof APPFLOW_ANALYSIS_MODES)[number];

/** Default: shadow renders legacy and compares engine projection. */
export const DEFAULT_APPFLOW_ANALYSIS_MODE: AppflowAnalysisMode = "shadow";

export function isAppflowAnalysisMode(value: unknown): value is AppflowAnalysisMode {
  return value === "legacy" || value === "shadow" || value === "engine";
}

export function parseAppflowAnalysisMode(raw: string | undefined | null): AppflowAnalysisMode {
  if (raw == null) return DEFAULT_APPFLOW_ANALYSIS_MODE;
  const trimmed = raw.trim().toLowerCase();
  if (trimmed.length === 0) return DEFAULT_APPFLOW_ANALYSIS_MODE;
  if (isAppflowAnalysisMode(trimmed)) return trimmed;
  return DEFAULT_APPFLOW_ANALYSIS_MODE;
}
