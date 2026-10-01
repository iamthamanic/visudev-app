/**
 * Detector port + registry domain for ScanDetectorEngine (SDE-03).
 * Runtime-neutral — no Node/Deno/DOM imports.
 * Location: shared/scan-detector/domain/detector.ts
 */

import type { DetectorCapability, ScanEvidence, ScanFact } from "../types.js";

export type DetectorRunStatus = "success" | "partial" | "failed" | "skipped";

export interface DetectorBudget {
  /** Soft wall-clock budget in milliseconds (adapter-enforced). */
  timeoutMs: number;
  /** Optional max facts a detector may emit. */
  maxFacts?: number;
}

export interface DetectorRunContext {
  projectId: string;
  enrichment: "off" | "on" | "unknown";
  /** Capability ids already satisfied / requested for this scan. */
  requestedCapabilityIds: readonly string[];
  budget: DetectorBudget;
}

export interface DetectorRunResult {
  detectorId: string;
  status: DetectorRunStatus;
  facts: ScanFact[];
  evidence: ScanEvidence[];
  /** Human-readable error when status is failed/partial. */
  errorMessage?: string;
  /** Capability ids this run claims to have exercised. */
  exercisedCapabilityIds?: string[];
}

export interface ScanDetector {
  readonly id: string;
  readonly priority: number;
  readonly capability: DetectorCapability;
  /**
   * Pure/async detection. Must not throw across the orchestrator boundary;
   * adapters may still wrap for crash isolation.
   */
  run(context: DetectorRunContext): Promise<DetectorRunResult> | DetectorRunResult;
}

export interface DetectorRegistry {
  register(detector: ScanDetector): void;
  list(): readonly ScanDetector[];
  /**
   * Select detectors whose capability id is in `capabilityIds` (or all if empty),
   * ordered by ascending priority then stable id.
   */
  select(capabilityIds: readonly string[]): ScanDetector[];
}
