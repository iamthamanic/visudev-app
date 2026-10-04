/**
 * Local vs GitHub semantic parity under shared capability intersection (PR-16).
 * Host-only capabilities are reported as deltas, never as semantic mismatches.
 * Location: shared/scan-detector/application/local-github-parity.ts
 */

import { compareShadowParity, extractSemanticBaseline } from "../../migration-baseline.js";
import type { ShadowParityResult } from "../../migration-baseline.types.js";
import type { SoftwareGraph } from "../../software-graph.types.js";
import {
  applyEngineHostCutover,
  CLOUD_ENGINE_CAPABILITIES_ABSENT,
  CLOUD_ENGINE_CAPABILITIES_PRESENT,
  type EngineHostCutoverResult,
} from "./apply-engine-host-cutover.js";

export interface LocalGithubParityInput {
  projectId: string;
  /** Canonical SoftwareGraph after Local enrich / Cloud adapt (same SHA inputs). */
  localGraph: SoftwareGraph;
  cloudGraph: SoftwareGraph;
  modeRaw?: string | null;
  /** Capabilities both hosts claim for this compare (default: cloud present). */
  sharedCapabilities?: readonly string[];
}

export interface CapabilityDelta {
  capability: string;
  local: "present" | "absent";
  cloud: "present" | "absent";
  /** When true, must not fail semantic parity. */
  hostSpecific: boolean;
}

export interface LocalGithubParityResult {
  projectId: string;
  status: "pass" | "fail";
  sharedCapabilities: string[];
  capabilityDeltas: CapabilityDelta[];
  semantic: ShadowParityResult;
  local: EngineHostCutoverResult;
  cloud: EngineHostCutoverResult;
}

function capabilityDeltas(
  local: EngineHostCutoverResult,
  cloud: EngineHostCutoverResult,
): CapabilityDelta[] {
  const names = new Set([
    ...local.capabilitiesPresent,
    ...local.capabilitiesAbsent,
    ...cloud.capabilitiesPresent,
    ...cloud.capabilitiesAbsent,
  ]);
  const deltas: CapabilityDelta[] = [];
  for (const capability of [...names].sort()) {
    const localPresent = local.capabilitiesPresent.includes(capability);
    const cloudPresent = cloud.capabilitiesPresent.includes(capability);
    if (localPresent === cloudPresent) continue;
    const knownCloudAbsent = CLOUD_ENGINE_CAPABILITIES_ABSENT.includes(
      capability as (typeof CLOUD_ENGINE_CAPABILITIES_ABSENT)[number],
    );
    deltas.push({
      capability,
      local: localPresent ? "present" : "absent",
      cloud: cloudPresent ? "present" : "absent",
      // Local-only runtime/schema/filesystem gaps are host-specific, not semantic fails.
      hostSpecific: knownCloudAbsent || (localPresent && !cloudPresent),
    });
  }
  return deltas;
}
/**
 * Compare Local and Cloud cutover outputs for semantic equivalence under the
 * shared capability intersection. Host-only capability gaps are listed but
 * do not fail the semantic gate.
 */
export function compareLocalGithubParity(input: LocalGithubParityInput): LocalGithubParityResult {
  const sharedCapabilities = [
    ...(input.sharedCapabilities ?? CLOUD_ENGINE_CAPABILITIES_PRESENT),
  ].sort((a, b) => a.localeCompare(b));

  const local = applyEngineHostCutover({
    host: "local",
    legacyGraph: input.localGraph,
    modeRaw: input.modeRaw ?? "engine",
    // Restrict Local present set to intersection for fingerprinting fairness
    capabilitiesPresent: sharedCapabilities,
    capabilitiesAbsent: [...CLOUD_ENGINE_CAPABILITIES_ABSENT],
  });
  const cloud = applyEngineHostCutover({
    host: "cloud",
    legacyGraph: input.cloudGraph,
    modeRaw: input.modeRaw ?? "engine",
    capabilitiesPresent: sharedCapabilities,
    capabilitiesAbsent: [...CLOUD_ENGINE_CAPABILITIES_ABSENT],
  });

  // Full host defaults for delta reporting (not the restricted compare set)
  const localFull = applyEngineHostCutover({
    host: "local",
    legacyGraph: input.localGraph,
    modeRaw: input.modeRaw ?? "engine",
  });
  const cloudFull = applyEngineHostCutover({
    host: "cloud",
    legacyGraph: input.cloudGraph,
    modeRaw: input.modeRaw ?? "engine",
  });

  const expected = extractSemanticBaseline({
    projectId: input.projectId,
    graph: local.resolved.graph,
    semanticModel: local.semanticSystemModel,
  });
  const actual = extractSemanticBaseline({
    projectId: input.projectId,
    graph: cloud.resolved.graph,
    semanticModel: cloud.semanticSystemModel,
  });
  const semantic = compareShadowParity(expected, actual);
  const deltas = capabilityDeltas(localFull, cloudFull);

  return {
    projectId: input.projectId,
    // Capability deltas are informational; only semantic fingerprint fails the gate.
    status: semantic.status === "pass" ? "pass" : "fail",
    sharedCapabilities,
    capabilityDeltas: deltas,
    semantic,
    local,
    cloud,
  };
}
/** Manifest helper: projects with parity.enabled for automated gates. */
export function listParityEnabledProjectIds(
  projects: ReadonlyArray<{
    id?: string;
    parity?: { enabled?: boolean };
    source?: { kind?: string };
  }>,
): string[] {
  return projects
    .filter(
      (project) =>
        project.parity?.enabled === true &&
        project.source?.kind === "github" &&
        typeof project.id === "string",
    )
    .map((project) => project.id as string)
    .sort((a, b) => a.localeCompare(b));
}
