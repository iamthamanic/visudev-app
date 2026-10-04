/**
 * Capability-level coverage read model (#378 / PR-04).
 * COMPLETE/PARTIAL/UNAVAILABLE + DetectionState for honest empty states.
 * Location: shared/scan-detector/application/capability-coverage.ts
 */

import { type CoverageStatus, type DetectionState, resolveCoverageStatus } from "../epistemic.js";
import type { ScanSnapshot } from "../types.js";

export type CoverageCapabilityId =
  | "repositoryScan"
  | "atlas"
  | "architecture"
  | "dependencies"
  | "execution"
  | "infrastructure"
  | "diagnostics"
  | "appflowStatic"
  | "appflowRuntime"
  | "data"
  | "evidenceLinks"
  | "knowledgeStatus";

export type CoverageLimitReason =
  | "budget"
  | "timeout"
  | "auth-barrier"
  | "safety-barrier"
  | "unsupported"
  | "parser-errors"
  | "runtime-missing"
  | "irrelevant"
  | null;

export interface CapabilityCoverageEntry {
  capabilityId: CoverageCapabilityId;
  coverage: CoverageStatus;
  detection: DetectionState;
  /** Machine-readable reason when not COMPLETE. */
  reason: CoverageLimitReason;
  /** Short German explanation for UI empty states — no sensitive evidence. */
  summaryDe: string;
}

export interface CapabilityCoverageReport {
  version: 1;
  projectId: string;
  analyzedAt: string;
  capabilities: CapabilityCoverageEntry[];
}

export interface CoverageSignals {
  projectId?: string;
  analyzedAt?: string;
  /** Scan produced any facts/nodes. */
  hasFacts?: boolean;
  filesAnalyzed?: number;
  filesDiscovered?: number;
  factsTransportSelected?: number;
  factsExtracted?: number;
  transportCapped?: boolean;
  astFilesFailed?: number;
  astFilesAttempted?: number;
  runtimeAvailable?: boolean;
  runtimeRequired?: boolean;
  dataLayerPresent?: boolean;
  capabilitySupported?: Partial<Record<CoverageCapabilityId, boolean>>;
  limitedBy?: CoverageLimitReason;
}

const ALL_CAPABILITIES: readonly CoverageCapabilityId[] = [
  "repositoryScan",
  "atlas",
  "architecture",
  "dependencies",
  "execution",
  "infrastructure",
  "diagnostics",
  "appflowStatic",
  "appflowRuntime",
  "data",
  "evidenceLinks",
  "knowledgeStatus",
] as const;

function detectionFor(coverage: CoverageStatus, signals: CoverageSignals): DetectionState {
  if (signals.limitedBy === "unsupported") return "UNSUPPORTED";
  if (coverage === "UNAVAILABLE") {
    if (signals.runtimeRequired && signals.runtimeAvailable === false) return "NOT_DETECTED";
    if (signals.hasFacts === false) return "NOT_DETECTED";
    return "UNKNOWN";
  }
  if (coverage === "PARTIAL") {
    if ((signals.astFilesFailed ?? 0) > 0) return "UNKNOWN";
    return "UNKNOWN";
  }
  // COMPLETE with zero facts → true absence of detectable surface
  if (signals.hasFacts === false) return "ABSENT";
  return "ABSENT";
}

function summaryDe(
  capabilityId: CoverageCapabilityId,
  coverage: CoverageStatus,
  reason: CoverageLimitReason,
  detection: DetectionState,
): string {
  if (coverage === "COMPLETE") {
    return detection === "ABSENT"
      ? `${capabilityId}: vollständig geprüft — nichts erkannt (ABSENT).`
      : `${capabilityId}: Analyse vollständig.`;
  }
  if (coverage === "UNAVAILABLE") {
    if (reason === "unsupported") return `${capabilityId}: für dieses Projekt nicht unterstützt.`;
    if (reason === "runtime-missing") return `${capabilityId}: Runtime nicht verfügbar.`;
    if (reason === "irrelevant") return `${capabilityId}: für dieses Projekt nicht relevant.`;
    return `${capabilityId}: nicht verfügbar (${detection}).`;
  }
  if (reason === "budget") return `${capabilityId}: teilweise — Budgetgrenze erreicht.`;
  if (reason === "timeout") return `${capabilityId}: teilweise — Timeout.`;
  if (reason === "parser-errors") return `${capabilityId}: teilweise — Parserfehler in Teilmenge.`;
  if (reason === "auth-barrier") return `${capabilityId}: teilweise — Auth-Barriere.`;
  if (reason === "safety-barrier") return `${capabilityId}: teilweise — Safety-Barriere.`;
  return `${capabilityId}: teilweise analysiert (${detection}).`;
}

/**
 * Build coverage entries from scan signals. Never marks COMPLETE when limitedBy budget/timeout.
 */
export function buildCapabilityCoverageReport(signals: CoverageSignals): CapabilityCoverageReport {
  const transportCapped = Boolean(
    signals.transportCapped ||
    (typeof signals.factsExtracted === "number" &&
      typeof signals.factsTransportSelected === "number" &&
      signals.factsTransportSelected < signals.factsExtracted),
  );
  const filePartial =
    typeof signals.filesAnalyzed === "number" &&
    typeof signals.filesDiscovered === "number" &&
    signals.filesAnalyzed < signals.filesDiscovered;
  const parserPartial = (signals.astFilesFailed ?? 0) > 0;
  const globalLimit: CoverageLimitReason =
    signals.limitedBy ??
    (filePartial || transportCapped ? "budget" : parserPartial ? "parser-errors" : null);

  const capabilities = ALL_CAPABILITIES.map((capabilityId) => {
    const supported = signals.capabilitySupported?.[capabilityId];
    if (supported === false) {
      const coverage: CoverageStatus = "UNAVAILABLE";
      const reason: CoverageLimitReason = "unsupported";
      const detection: DetectionState = "UNSUPPORTED";
      return {
        capabilityId,
        coverage,
        detection,
        reason,
        summaryDe: summaryDe(capabilityId, coverage, reason, detection),
      };
    }

    if (capabilityId === "appflowRuntime" && signals.runtimeAvailable === false) {
      const entryCoverage: CoverageStatus = "UNAVAILABLE";
      const reason: CoverageLimitReason = "runtime-missing";
      const detection: DetectionState = "NOT_DETECTED";
      return {
        capabilityId,
        coverage: entryCoverage,
        detection,
        reason,
        summaryDe: summaryDe(capabilityId, entryCoverage, reason, detection),
      };
    }

    if (capabilityId === "data" && signals.dataLayerPresent === false) {
      const coverage: CoverageStatus = "UNAVAILABLE";
      const reason: CoverageLimitReason = "irrelevant";
      const detection: DetectionState = "ABSENT";
      return {
        capabilityId,
        coverage,
        detection,
        reason,
        summaryDe: summaryDe(capabilityId, coverage, reason, detection),
      };
    }

    // Completeness is about analysis depth, not whether entities exist.
    const complete = !globalLimit;
    const coverage = resolveCoverageStatus({
      available: true,
      complete,
      limitedBy:
        globalLimit === "budget" ||
        globalLimit === "timeout" ||
        globalLimit === "auth-barrier" ||
        globalLimit === "safety-barrier" ||
        globalLimit === "unsupported"
          ? globalLimit
          : globalLimit === "parser-errors"
            ? "budget"
            : null,
    });
    // Parser errors → PARTIAL (never COMPLETE)
    const finalCoverage: CoverageStatus =
      parserPartial && coverage === "COMPLETE" ? "PARTIAL" : coverage;
    const reason: CoverageLimitReason =
      finalCoverage === "COMPLETE"
        ? null
        : (globalLimit ?? (parserPartial ? "parser-errors" : null));
    const detection = detectionFor(finalCoverage, signals);
    return {
      capabilityId,
      coverage: finalCoverage,
      detection,
      reason,
      summaryDe: summaryDe(capabilityId, finalCoverage, reason, detection),
    };
  });

  return {
    version: 1,
    projectId: signals.projectId ?? "unknown",
    analyzedAt: signals.analyzedAt ?? new Date(0).toISOString(),
    capabilities,
  };
}

/** Derive coverage signals from a ScanSnapshot (+ optional transport metadata). */
export function coverageSignalsFromSnapshot(
  snapshot: ScanSnapshot,
  extras?: Partial<CoverageSignals>,
): CoverageSignals {
  return {
    projectId: snapshot.projectId,
    analyzedAt: snapshot.analyzedAt,
    hasFacts: snapshot.facts.length > 0,
    ...extras,
  };
}

/**
 * Empty-state helper for views: never treat NOT_DETECTED as ABSENT.
 */
export function emptyStateFromCoverage(entry: CapabilityCoverageEntry): {
  coverage: CoverageStatus;
  detection: DetectionState;
  titleDe: string;
  bodyDe: string;
} {
  const titleDe =
    entry.coverage === "UNAVAILABLE"
      ? "Nicht verfügbar"
      : entry.coverage === "PARTIAL"
        ? "Teilweise analysiert"
        : entry.detection === "ABSENT"
          ? "Nichts vorhanden"
          : "Keine Darstellung";
  const bodyDe =
    entry.detection === "NOT_DETECTED"
      ? "Es wurde nichts erkannt — das bedeutet nicht, dass nichts existiert."
      : entry.detection === "UNSUPPORTED"
        ? "Diese Capability wird für die aktuelle Quelle nicht unterstützt."
        : entry.detection === "UNKNOWN"
          ? "Der Zustand ist unklar (z. B. Parser-/Budget-Lücken)."
          : entry.summaryDe;
  return {
    coverage: entry.coverage,
    detection: entry.detection,
    titleDe,
    bodyDe,
  };
}
