/**
 * RuntimeEvidenceProvider port (SDE-09).
 * Adapters (Playwright, …) produce crawl results; engine normalizes to facts.
 * Location: shared/scan-detector/domain/runtime/runtime-observer-port.ts
 */

import type { DetectorCapability } from "../../types.js";
import type { RuntimeObserverCrawlResult } from "./crawl-result.js";

export const RUNTIME_OBSERVER_DETECTOR_ID = "runtime-playwright-observer-v1";

export const RUNTIME_OBSERVER_CAPABILITY: DetectorCapability = {
  id: "runtime-crawl",
  label: "Runtime Playwright Observer",
  family: "runtime-crawl",
  version: "1.0.0",
  supports: ["web"],
};

export interface RuntimeObserverRunRequest {
  projectId: string;
  baseUrl: string;
  /** Known screen routes from static/AppFlow analysis (optional). */
  screens?: ReadonlyArray<{ id: string; name: string; path: string; type?: string }>;
  maxScreens?: number;
  maxClicksPerScreen?: number;
  enrichment: "off" | "on" | "unknown";
}

/**
 * Port implemented by Playwright (or future) adapters.
 * Must enforce safe-action policy and redact secrets before returning.
 */
export interface RuntimeEvidenceProvider {
  observe(request: RuntimeObserverRunRequest): Promise<RuntimeObserverCrawlResult>;
}
