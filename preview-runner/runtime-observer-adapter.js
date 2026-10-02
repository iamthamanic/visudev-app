/**
 * Playwright RuntimeEvidenceProvider adapter (SDE-09).
 * Wraps existing runRuntimeCrawl; does not reimplement crawl heuristics.
 * Location: preview-runner/runtime-observer-adapter.js
 */

import { runRuntimeCrawl } from "./runtime-crawl.js";

/**
 * @param {{ logger?: Console }} [options]
 * @returns {{ observe: (request: object) => Promise<object> }}
 */
export function createPlaywrightRuntimeEvidenceProvider(options = {}) {
  const logger = options.logger ?? console;
  return {
    /**
     * @param {{
     *   projectId: string,
     *   baseUrl: string,
     *   screens?: Array<{ id: string, name: string, path: string, type?: string }>,
     *   maxScreens?: number,
     *   maxClicksPerScreen?: number,
     *   enrichment: "off"|"on"|"unknown"
     * }} request
     */
    async observe(request) {
      const screens = (request.screens ?? []).map((screen) => ({
        id: screen.id,
        name: screen.name,
        path: screen.path,
        type: screen.type ?? "route",
      }));
      return runRuntimeCrawl({
        baseUrl: request.baseUrl,
        screens,
        maxScreens: request.maxScreens,
        maxClicksPerScreen: request.maxClicksPerScreen,
        logger,
      });
    },
  };
}
