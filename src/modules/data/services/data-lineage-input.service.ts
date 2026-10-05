/**
 * Assemble BuildDataLineageInput from existing product payloads (PR-22).
 * Does not invent joins — only passes IR already produced by engine adapters.
 * Location: src/modules/data/services/data-lineage-input.service.ts
 */

import type { SoftwareGraph } from "../../../../shared/software-graph.types.js";
import type { LegacyScreenLike } from "../../../../shared/ui-interaction-graph.types.js";
import {
  resolveDataAnalysis,
  type LegacyErdSnapshot,
} from "../../../lib/visudev-api/data-analysis";
import {
  adaptLegacyScreensToUiGraph,
  buildDataLineage,
  softwareGraphToScanFacts,
  type BuildDataLineageInput,
  type DataLineageGraph,
} from "../../../lib/visudev-api/data-lineage";

export interface AssembleDataLineageInput {
  projectId: string;
  analyzedAt?: string;
  software: SoftwareGraph | null | undefined;
  erd: LegacyErdSnapshot | Record<string, unknown> | null | undefined;
  appflowScreens?: unknown[] | null;
}

function asLegacyScreens(screens: unknown[] | null | undefined): LegacyScreenLike[] {
  if (!Array.isArray(screens)) return [];
  return screens.filter((item): item is LegacyScreenLike => {
    if (!item || typeof item !== "object") return false;
    const record = item as Record<string, unknown>;
    return (
      typeof record.id === "string" &&
      typeof record.name === "string" &&
      typeof record.path === "string"
    );
  });
}

export function assembleDataLineageInput(
  input: AssembleDataLineageInput,
): BuildDataLineageInput | null {
  if (!input.software) return null;
  const analyzedAt = input.analyzedAt || new Date().toISOString();
  const legacyErd = input.erd as LegacyErdSnapshot | null | undefined;
  const dataGraph =
    legacyErd && (Array.isArray(legacyErd.tables) || Array.isArray(legacyErd.nodes))
      ? (resolveDataAnalysis({ mode: "engine", legacyErd }).dataGraph ?? null)
      : null;
  const screens = asLegacyScreens(input.appflowScreens);
  const ui =
    screens.length > 0
      ? adaptLegacyScreensToUiGraph({
          projectId: input.projectId,
          analyzedAt,
          screens,
        })
      : null;
  const scanBundle = softwareGraphToScanFacts(input.software);
  return {
    projectId: input.projectId,
    analyzedAt,
    software: input.software,
    ui,
    data: dataGraph,
    scan: { facts: scanBundle.facts, evidence: scanBundle.evidence },
  };
}

export function buildDataLineageFromProductInputs(
  input: AssembleDataLineageInput,
): DataLineageGraph | null {
  const assembled = assembleDataLineageInput(input);
  if (!assembled) return null;
  return buildDataLineage(assembled);
}
