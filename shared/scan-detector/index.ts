/**
 * ScanDetectorEngine public contract surface (SDE-02 / SDE-03).
 * Location: shared/scan-detector/index.ts
 */

export type {
  DetectorCapability,
  ScanConfidence,
  ScanEvidence,
  ScanEvidenceOriginKind,
  ScanEvidencePayload,
  ScanFact,
  ScanKnowledgeStatus,
  ScanProvenance,
  ScanRepoMetadata,
  ScanSnapshot,
  ScanVersionManifest,
} from "./types.js";

export { isAuthoritativeEvidence, isScanKnowledgeStatus } from "./types.js";

export type {
  DetectorBudget,
  DetectorRegistry,
  DetectorRunContext,
  DetectorRunResult,
  DetectorRunStatus,
  ScanDetector,
} from "./domain/detector.js";

export { InMemoryDetectorRegistry } from "./application/detector-registry.js";
export { ScanDetectorOrchestrator } from "./application/orchestrator.js";
export type { OrchestratorInput, OrchestratorPorts } from "./application/orchestrator.js";
