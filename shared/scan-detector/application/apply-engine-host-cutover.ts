/**
 * Shared Local/Cloud engine host cutover (SDE-14).
 * Runs resolveBlueprintAnalysis + capability manifest — no host-specific semantics.
 * Location: shared/scan-detector/application/apply-engine-host-cutover.ts
 */

import { buildSemanticSystemModel } from "../../semantic-system-model.js";
import type { SemanticSystemModel } from "../../semantic-system-model.types.js";
import type { SoftwareGraph } from "../../software-graph.types.js";
import {
  DEFAULT_BLUEPRINT_ANALYSIS_MODE,
  parseBlueprintAnalysisMode,
  type BlueprintAnalysisMode,
} from "../domain/blueprint-analysis-mode.js";
import {
  resolveBlueprintAnalysis,
  type ResolveBlueprintAnalysisResult,
} from "./resolve-blueprint-analysis.js";

export type EngineHostKind = "local" | "cloud";

/** Capabilities the cloud GitHub adapter can exercise today. */
export const CLOUD_ENGINE_CAPABILITIES_PRESENT = ["static-blueprint"] as const;

/** Capabilities Local may have that Cloud must not invent. */
export const CLOUD_ENGINE_CAPABILITIES_ABSENT = [
  "runtime-observer",
  "schema-data",
  "filesystem-discovery-full",
] as const;

export interface EngineHostCutoverInput {
  host: EngineHostKind;
  legacyGraph: SoftwareGraph;
  /** Raw env string; defaults via parseBlueprintAnalysisMode. */
  modeRaw?: string | null;
  enrichment?: "off" | "on" | "unknown";
  /** Override capability lists (tests). */
  capabilitiesPresent?: readonly string[];
  capabilitiesAbsent?: readonly string[];
}

export interface EngineHostCutoverResult {
  host: EngineHostKind;
  mode: BlueprintAnalysisMode;
  resolved: ResolveBlueprintAnalysisResult;
  semanticSystemModel: SemanticSystemModel;
  capabilitiesPresent: string[];
  capabilitiesAbsent: string[];
  engineVersion: string;
}

function defaultCapabilities(host: EngineHostKind): {
  present: string[];
  absent: string[];
} {
  if (host === "cloud") {
    return {
      present: [...CLOUD_ENGINE_CAPABILITIES_PRESENT],
      absent: [...CLOUD_ENGINE_CAPABILITIES_ABSENT],
    };
  }
  return {
    present: ["static-blueprint", "filesystem-discovery-full", "runtime-observer", "schema-data"],
    absent: [],
  };
}

/**
 * Apply shared engine resolve for a host. Cloud and Local share this path so
 * semantic models stay equivalent for equal SoftwareGraph inputs.
 */
export function applyEngineHostCutover(input: EngineHostCutoverInput): EngineHostCutoverResult {
  const mode = parseBlueprintAnalysisMode(input.modeRaw ?? undefined);
  const caps = defaultCapabilities(input.host);
  const capabilitiesPresent = [...(input.capabilitiesPresent ?? caps.present)];
  const capabilitiesAbsent = [...(input.capabilitiesAbsent ?? caps.absent)];

  const resolved = resolveBlueprintAnalysis({
    mode,
    legacyGraph: input.legacyGraph,
    enrichment: input.enrichment ?? "off",
  });

  return {
    host: input.host,
    mode: mode || DEFAULT_BLUEPRINT_ANALYSIS_MODE,
    resolved,
    semanticSystemModel: buildSemanticSystemModel(resolved.graph),
    capabilitiesPresent,
    capabilitiesAbsent,
    engineVersion: "0.1.0-sde",
  };
}
