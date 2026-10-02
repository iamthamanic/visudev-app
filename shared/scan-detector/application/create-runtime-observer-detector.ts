/**
 * ScanDetector wrapper around RuntimeEvidenceProvider (SDE-09).
 * Location: shared/scan-detector/application/create-runtime-observer-detector.ts
 */

import type { DetectorRunContext, DetectorRunResult, ScanDetector } from "../domain/detector.js";
import type { RuntimeEvidenceProvider } from "../domain/runtime/runtime-observer-port.js";
import {
  RUNTIME_OBSERVER_CAPABILITY,
  RUNTIME_OBSERVER_DETECTOR_ID,
} from "../domain/runtime/runtime-observer-port.js";
import { normalizeRuntimeEvidence } from "./normalize-runtime-evidence.js";

export interface CreateRuntimeObserverDetectorOptions {
  provider: RuntimeEvidenceProvider;
  /** Resolve base URL / screens for a detector run. */
  resolveRequest: (context: DetectorRunContext) =>
    | {
        baseUrl: string;
        screens?: ReadonlyArray<{ id: string; name: string; path: string; type?: string }>;
        maxScreens?: number;
        maxClicksPerScreen?: number;
        knownStaticSubjectIds?: ReadonlySet<string>;
      }
    | Promise<{
        baseUrl: string;
        screens?: ReadonlyArray<{ id: string; name: string; path: string; type?: string }>;
        maxScreens?: number;
        maxClicksPerScreen?: number;
        knownStaticSubjectIds?: ReadonlySet<string>;
      }>;
}

export function createRuntimeObserverDetector(
  options: CreateRuntimeObserverDetectorOptions,
): ScanDetector {
  return {
    id: RUNTIME_OBSERVER_DETECTOR_ID,
    priority: 40,
    capability: RUNTIME_OBSERVER_CAPABILITY,
    async run(context: DetectorRunContext): Promise<DetectorRunResult> {
      try {
        const request = await options.resolveRequest(context);
        if (!request.baseUrl?.trim()) {
          return {
            detectorId: RUNTIME_OBSERVER_DETECTOR_ID,
            status: "skipped",
            facts: [],
            evidence: [],
            errorMessage: "Runtime observer skipped: missing baseUrl",
          };
        }

        const crawl = await options.provider.observe({
          projectId: context.projectId,
          baseUrl: request.baseUrl,
          screens: request.screens,
          maxScreens: request.maxScreens,
          maxClicksPerScreen: request.maxClicksPerScreen,
          enrichment: context.enrichment,
        });

        const normalized = normalizeRuntimeEvidence({
          crawl,
          knownStaticSubjectIds: request.knownStaticSubjectIds,
        });

        const maxFacts = context.budget.maxFacts;
        const facts =
          typeof maxFacts === "number" && normalized.facts.length > maxFacts
            ? normalized.facts.slice(0, maxFacts)
            : normalized.facts;

        return {
          detectorId: RUNTIME_OBSERVER_DETECTOR_ID,
          status: facts.length < normalized.facts.length ? "partial" : "success",
          facts,
          evidence: normalized.evidence,
          exercisedCapabilityIds: [RUNTIME_OBSERVER_CAPABILITY.id],
        };
      } catch (error) {
        return {
          detectorId: RUNTIME_OBSERVER_DETECTOR_ID,
          status: "failed",
          facts: [],
          evidence: [],
          errorMessage: error instanceof Error ? error.message : "runtime observer detector failed",
        };
      }
    },
  };
}
