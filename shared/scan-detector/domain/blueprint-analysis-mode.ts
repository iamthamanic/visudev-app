/**
 * Blueprint analysis mode — SDE-15: engine is the only runtime authority.
 * Location: shared/scan-detector/domain/blueprint-analysis-mode.ts
 */

export const BLUEPRINT_ANALYSIS_MODES = ["engine"] as const;

export type BlueprintAnalysisMode = (typeof BLUEPRINT_ANALYSIS_MODES)[number];

/** Final cutover default (SDE-15): engine projection is authoritative. */
export const DEFAULT_BLUEPRINT_ANALYSIS_MODE: BlueprintAnalysisMode = "engine";

export function isBlueprintAnalysisMode(value: unknown): value is BlueprintAnalysisMode {
  return value === "engine";
}

/**
 * Parse env / config string. Retired legacy/shadow values map to engine.
 */
export function parseBlueprintAnalysisMode(raw: string | undefined | null): BlueprintAnalysisMode {
  void raw;
  return DEFAULT_BLUEPRINT_ANALYSIS_MODE;
}
