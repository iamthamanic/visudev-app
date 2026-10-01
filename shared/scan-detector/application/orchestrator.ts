/**
 * ScanDetectorEngine orchestrator — runs selected detectors, isolates failures.
 * Location: shared/scan-detector/application/orchestrator.ts
 */

import type {
  DetectorBudget,
  DetectorRegistry,
  DetectorRunContext,
  DetectorRunResult,
  ScanDetector,
} from "../domain/detector.js";
import type { ScanSnapshot } from "../types.js";

export interface OrchestratorInput {
  projectId: string;
  analyzedAt: string;
  enrichment: "off" | "on" | "unknown";
  engineVersion: string;
  requestedCapabilityIds?: readonly string[];
  budget?: Partial<DetectorBudget>;
  repo?: ScanSnapshot["repo"];
}

export interface OrchestratorPorts {
  /** Optional crash-isolation wrapper (Local host). Default: await detector.run. */
  runDetector?: (detector: ScanDetector, context: DetectorRunContext) => Promise<DetectorRunResult>;
}

const DEFAULT_BUDGET: DetectorBudget = { timeoutMs: 30_000, maxFacts: 10_000 };

export class ScanDetectorOrchestrator {
  constructor(
    private readonly registry: DetectorRegistry,
    private readonly ports: OrchestratorPorts = {},
  ) {}

  async run(input: OrchestratorInput): Promise<{
    snapshot: ScanSnapshot;
    detectorResults: DetectorRunResult[];
  }> {
    const requested = input.requestedCapabilityIds ?? [];
    const selected = this.registry.select(requested);
    const budget: DetectorBudget = {
      timeoutMs: input.budget?.timeoutMs ?? DEFAULT_BUDGET.timeoutMs,
      maxFacts: input.budget?.maxFacts ?? DEFAULT_BUDGET.maxFacts,
    };
    const context: DetectorRunContext = {
      projectId: input.projectId,
      enrichment: input.enrichment,
      requestedCapabilityIds: requested,
      budget,
    };

    const detectorResults: DetectorRunResult[] = [];
    for (const detector of selected) {
      const result = await this.executeOne(detector, context);
      detectorResults.push(normalizeResult(detector.id, result, budget.maxFacts));
    }

    const facts = detectorResults.flatMap((result) => result.facts);
    const evidence = detectorResults.flatMap((result) => result.evidence);
    const capabilities = selected.map((detector) => detector.capability);
    const detectorVersions = Object.fromEntries(
      selected.map((detector) => [detector.id, detector.capability.version]),
    );

    const snapshot: ScanSnapshot = {
      version: 1,
      projectId: input.projectId,
      analyzedAt: input.analyzedAt,
      enrichment: input.enrichment,
      repo: input.repo ?? {},
      versions: {
        engineVersion: input.engineVersion,
        modelVersions: {},
        detectorVersions,
      },
      capabilities,
      facts,
      evidence,
    };

    return { snapshot, detectorResults };
  }

  private async executeOne(
    detector: ScanDetector,
    context: DetectorRunContext,
  ): Promise<DetectorRunResult> {
    const runner =
      this.ports.runDetector ??
      (async (det: ScanDetector, ctx: DetectorRunContext) => det.run(ctx));
    try {
      return await runner(detector, context);
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown detector failure";
      return {
        detectorId: detector.id,
        status: "failed",
        facts: [],
        evidence: [],
        errorMessage: message,
      };
    }
  }
}

function normalizeResult(
  detectorId: string,
  result: DetectorRunResult,
  maxFacts: number | undefined,
): DetectorRunResult {
  const facts =
    typeof maxFacts === "number" && result.facts.length > maxFacts
      ? result.facts.slice(0, maxFacts)
      : result.facts;
  return {
    ...result,
    detectorId,
    facts,
    evidence: Array.isArray(result.evidence) ? result.evidence : [],
  };
}
