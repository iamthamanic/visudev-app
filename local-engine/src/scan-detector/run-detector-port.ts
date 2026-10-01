/**
 * Local Engine port adapter — isolates detector crashes for the orchestrator.
 * Location: local-engine/src/scan-detector/run-detector-port.ts
 */

import type {
  DetectorRunContext,
  DetectorRunResult,
  ScanDetector,
} from "../../../shared/scan-detector/domain/detector.js";

export async function runDetectorIsolated(
  detector: ScanDetector,
  context: DetectorRunContext,
): Promise<DetectorRunResult> {
  try {
    return await Promise.resolve(detector.run(context));
  } catch (error) {
    const message = error instanceof Error ? error.message : "detector crashed";
    return {
      detectorId: detector.id,
      status: "failed",
      facts: [],
      evidence: [],
      errorMessage: message,
    };
  }
}
