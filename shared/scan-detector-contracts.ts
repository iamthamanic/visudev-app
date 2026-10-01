/**
 * Compatibility re-exports for ScanDetector contracts (SDE-02).
 * Existing SoftwareGraph / SemanticSystemModel types remain authoritative for those models.
 * Location: shared/scan-detector-contracts.ts
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
} from "./scan-detector/index.js";

export { isAuthoritativeEvidence, isScanKnowledgeStatus } from "./scan-detector/index.js";
