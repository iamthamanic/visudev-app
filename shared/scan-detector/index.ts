/**
 * ScanDetectorEngine public contract surface (SDE-02).
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
