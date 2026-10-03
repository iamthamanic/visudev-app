/**
 * Static Blueprint detector adapter — wraps legacy buildSoftwareGraph (SDE-06).
 * Legacy builder remains the source of truth; this only ports results into engine facts.
 * Location: local-engine/src/scan-detector/static-blueprint-detector.ts
 */

import type {
  DetectorRunContext,
  DetectorRunResult,
  ScanDetector,
} from "../../../shared/scan-detector/domain/detector.js";
import { softwareGraphToScanFacts } from "../../../shared/scan-detector/application/software-graph-fact-bridge.js";
import type { DetectorCapability } from "../../../shared/scan-detector/types.js";
import type { RawBlueprintScan, SoftwareGraph } from "../types/api.types.js";
import { buildSoftwareGraph } from "../services/software-graph-builder.service.js";

export const STATIC_BLUEPRINT_DETECTOR_ID = "static-blueprint-graph-v1";

export const STATIC_BLUEPRINT_CAPABILITY: DetectorCapability = {
  id: "static-blueprint-graph",
  label: "Static Blueprint SoftwareGraph",
  family: "static-ast",
  version: "1.0.0",
  supports: ["typescript", "javascript", "python"],
};

export interface StaticBlueprintDetectorHost {
  /** Provide the RawBlueprintScan for this run (legacy extractor still available). */
  getScan(context: DetectorRunContext): RawBlueprintScan | Promise<RawBlueprintScan>;
}

/**
 * Create a ScanDetector that adapts the existing SoftwareGraph builder.
 * Does not re-implement heuristics — Strangler adapter only.
 */
export function createStaticBlueprintDetector(host: StaticBlueprintDetectorHost): ScanDetector {
  return {
    id: STATIC_BLUEPRINT_DETECTOR_ID,
    priority: 10,
    capability: STATIC_BLUEPRINT_CAPABILITY,
    async run(context: DetectorRunContext): Promise<DetectorRunResult> {
      try {
        const scan = await host.getScan(context);
        const graph: SoftwareGraph = buildSoftwareGraph(scan);
        const bundle = softwareGraphToScanFacts(graph, STATIC_BLUEPRINT_DETECTOR_ID);
        const maxFacts = context.budget.maxFacts;
        const facts =
          typeof maxFacts === "number" && bundle.facts.length > maxFacts
            ? bundle.facts.slice(0, maxFacts)
            : bundle.facts;
        return {
          detectorId: STATIC_BLUEPRINT_DETECTOR_ID,
          status: facts.length < bundle.facts.length ? "partial" : "success",
          facts,
          evidence: bundle.evidence,
          exercisedCapabilityIds: [STATIC_BLUEPRINT_CAPABILITY.id],
        };
      } catch (error) {
        return {
          detectorId: STATIC_BLUEPRINT_DETECTOR_ID,
          status: "failed",
          facts: [],
          evidence: [],
          errorMessage: error instanceof Error ? error.message : "static blueprint detector failed",
        };
      }
    },
  };
}
