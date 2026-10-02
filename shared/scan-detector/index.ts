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

export {
  scanFactsToSoftwareGraph,
  softwareGraphToScanFacts,
  type SoftwareGraphFactBundle,
} from "./application/software-graph-fact-bridge.js";

export {
  shadowCompareSoftwareGraphs,
  type ShadowCompareGraphsInput,
} from "./application/shadow-compare-graphs.js";

export {
  projectAppFlowReadModel,
  projectBlueprintReadModel,
  projectDataReadModel,
  type ProjectReadModelInput,
} from "./application/project-read-models.js";

export type {
  AppFlowProjectionReadModel,
  BlueprintProjectionReadModel,
  DataProjectionReadModel,
  ProjectionEntity,
  ProjectionEvidenceLink,
  ProjectionPageMeta,
  ProjectionQueryOptions,
  ProjectionQueryScope,
  ProjectionReadModel,
  ProjectionRelation,
  ProjectionSlice,
} from "./domain/projection/types.js";

export { PROJECTION_DEFAULT_LIMIT, PROJECTION_HARD_MAX_LIMIT } from "./domain/projection/types.js";

export {
  APPFLOW_FLOW_KIND_PREFIXES,
  APPFLOW_SCREEN_KIND_PREFIXES,
  APPFLOW_TRANSITION_KIND_PREFIXES,
  BLUEPRINT_ENTITY_KIND_PREFIXES,
  BLUEPRINT_RELATION_KIND_PREFIXES,
  DATA_RELATION_KIND_PREFIXES,
  DATA_TABLE_KIND_PREFIXES,
  isAppFlowFlowFact,
  isAppFlowScreenFact,
  isAppFlowTransitionFact,
  isBlueprintEntityFact,
  isBlueprintRelationFact,
  isDataRelationFact,
  isDataTableFact,
  isProjectionClaimedFact,
} from "./domain/projection/selectors.js";

export {
  BLUEPRINT_ANALYSIS_MODES,
  DEFAULT_BLUEPRINT_ANALYSIS_MODE,
  isBlueprintAnalysisMode,
  parseBlueprintAnalysisMode,
  type BlueprintAnalysisMode,
} from "./domain/blueprint-analysis-mode.js";

export {
  buildEngineGraphViaProjection,
  resolveBlueprintAnalysis,
  softwareGraphFromBlueprintProjection,
  type BlueprintAnalysisSource,
  type ResolveBlueprintAnalysisInput,
  type ResolveBlueprintAnalysisResult,
} from "./application/resolve-blueprint-analysis.js";
