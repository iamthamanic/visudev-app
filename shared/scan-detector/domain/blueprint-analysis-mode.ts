/**
 * Blueprint analysis mode contract for SDE-08 cutover (legacy | shadow | engine).
 * Location: shared/scan-detector/domain/blueprint-analysis-mode.ts
 */

export const BLUEPRINT_ANALYSIS_MODES = ["legacy", "shadow", "engine"] as const;

export type BlueprintAnalysisMode = (typeof BLUEPRINT_ANALYSIS_MODES)[number];

/** Default after SDE-08: shadow renders legacy and compares engine projection. */
export const DEFAULT_BLUEPRINT_ANALYSIS_MODE: BlueprintAnalysisMode = "shadow";

export function isBlueprintAnalysisMode(value: unknown): value is BlueprintAnalysisMode {
  return value === "legacy" || value === "shadow" || value === "engine";
}

/**
 * Parse env / config string. Unknown values fall back to the default (shadow).
 * Empty / unset also uses default so deployers get shadow parity telemetry.
 */
export function parseBlueprintAnalysisMode(raw: string | undefined | null): BlueprintAnalysisMode {
  if (raw == null) return DEFAULT_BLUEPRINT_ANALYSIS_MODE;
  const trimmed = raw.trim().toLowerCase();
  if (trimmed.length === 0) return DEFAULT_BLUEPRINT_ANALYSIS_MODE;
  if (isBlueprintAnalysisMode(trimmed)) return trimmed;
  return DEFAULT_BLUEPRINT_ANALYSIS_MODE;
}
