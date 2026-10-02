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

export {
  discoverProjectCapabilities,
  type DiscoverProjectCapabilitiesInput,
  type DiscoveryPathEntry,
} from "./application/discover-project-capabilities.js";

export type {
  DeploymentHint,
  DetectedDatastore,
  DetectedFramework,
  DetectedLanguage,
  DiscoveryFrameworkId,
  DiscoveryLanguageId,
  ProjectApplicationScope,
  ProjectCapabilities,
  UnsupportedSourceEntry,
} from "./domain/project-capabilities.js";

export { scopedSubjectId } from "./domain/project-capabilities.js";

export {
  DISCOVERY_INVENTORY_ONLY_EXTENSIONS,
  DISCOVERY_MAX_FILE_BYTES,
  DISCOVERY_SKIP_DIR_NAMES,
  DISCOVERY_SUPPORTED_EXTENSIONS,
  extensionOf,
  isSkippedDiscoveryDirName,
} from "./domain/discovery-policy.js";

export {
  fuseEvidenceAndIdentities,
  type FuseEvidenceInput,
} from "./domain/identity/fuse-evidence.js";

export type {
  EvidenceFusionResult,
  IdentityCandidate,
  IdentityMatchRecord,
  IdentityMatchRuleId,
  IdentityMatchStatus,
  SemanticIdentityKey,
} from "./domain/identity/types.js";

export {
  dominantKnowledgeStatus,
  isLlmOnlyEvidence,
  readSemanticKey,
} from "./domain/identity/types.js";

export { redactEvidence, redactFact, redactFactsAndEvidence } from "./domain/evidence/redact.js";
