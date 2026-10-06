/**
 * Web UI detector — adapts legacy Screen heuristics into UIInteractionGraph (SDE-10).
 * Location: shared/scan-detector/application/create-web-ui-detector.ts
 */

import type { DetectorCapability } from "../types.js";
import type { DetectorRunContext, DetectorRunResult, ScanDetector } from "../domain/detector.js";
import type { LegacyScreenLike } from "../../ui-interaction-graph.types.js";
import type { RuntimeObserverCrawlResult } from "../domain/runtime/crawl-result.js";
import { adaptLegacyScreensToUiGraph } from "./adapt-legacy-screens-to-ui-graph.js";
import { fuseRuntimeIntoUiGraph } from "./fuse-runtime-into-ui-graph.js";
import { uiGraphToScanFacts } from "./ui-graph-to-scan-facts.js";

export const WEB_UI_DETECTOR_ID = "web-ui-interaction-graph-v1";

export const WEB_UI_CAPABILITY: DetectorCapability = {
  id: "web-ui-interaction-graph",
  label: "Web UIInteractionGraph",
  family: "ui-interaction",
  version: "1.1.0",
  supports: ["react", "next", "nuxt", "web", "custom-navigation"],
};

export interface WebUiDetectorHost {
  getLegacyScreens(
    context: DetectorRunContext,
  ): readonly LegacyScreenLike[] | Promise<readonly LegacyScreenLike[]>;
  /** Optional runtime crawl already available for this project. */
  getRuntimeCrawl?(
    context: DetectorRunContext,
  ): RuntimeObserverCrawlResult | undefined | Promise<RuntimeObserverCrawlResult | undefined>;
}

export function createWebUiDetector(host: WebUiDetectorHost): ScanDetector {
  return {
    id: WEB_UI_DETECTOR_ID,
    priority: 30,
    capability: WEB_UI_CAPABILITY,
    async run(context: DetectorRunContext): Promise<DetectorRunResult> {
      try {
        const screens = await host.getLegacyScreens(context);
        let graph = adaptLegacyScreensToUiGraph({
          projectId: context.projectId,
          screens,
          detectorId: WEB_UI_DETECTOR_ID,
        });

        const crawl = host.getRuntimeCrawl ? await host.getRuntimeCrawl(context) : undefined;
        if (crawl) {
          graph = fuseRuntimeIntoUiGraph({
            graph,
            crawl,
            detectorId: WEB_UI_DETECTOR_ID,
          });
        }

        const bundle = uiGraphToScanFacts(graph, WEB_UI_DETECTOR_ID);
        const maxFacts = context.budget.maxFacts;
        const facts =
          typeof maxFacts === "number" && bundle.facts.length > maxFacts
            ? bundle.facts.slice(0, maxFacts)
            : bundle.facts;

        return {
          detectorId: WEB_UI_DETECTOR_ID,
          status: facts.length < bundle.facts.length ? "partial" : "success",
          facts,
          evidence: bundle.evidence,
          exercisedCapabilityIds: [WEB_UI_CAPABILITY.id],
        };
      } catch (error) {
        return {
          detectorId: WEB_UI_DETECTOR_ID,
          status: "failed",
          facts: [],
          evidence: [],
          errorMessage: error instanceof Error ? error.message : "web ui detector failed",
        };
      }
    },
  };
}
