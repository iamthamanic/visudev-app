/**
 * ScanDetectorEngine public contract surface (SDE-02 / SDE-03).
 * Location: shared/scan-detector/index.ts
 */

export type {
  CoverageStatus,
  DetectionState,
  DetectorCapability,
  KnowledgeStatus,
  LegacyScanKnowledgeStatus,
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

export { isAuthoritativeEvidence, isScanKnowledgeStatus, readKnowledgeStatus } from "./types.js";

export {
  applyOriginKnowledgePolicy,
  coerceKnowledgeStatus,
  dominantCanonicalKnowledgeStatus,
  isAuthoritativeKnowledgeStatus,
  isCoverageStatus,
  isDetectionState,
  isKnowledgeStatus,
  isLegacyScanKnowledgeStatus,
  resolveCoverageStatus,
  toLegacyScanKnowledgeStatus,
  COVERAGE_STATUSES,
  DETECTION_STATES,
  KNOWLEDGE_STATUSES,
  LEGACY_TO_KNOWLEDGE,
} from "./epistemic.js";

export {
  buildCapabilityCoverageReport,
  coverageSignalsFromSnapshot,
  emptyStateFromCoverage,
  type CapabilityCoverageEntry,
  type CapabilityCoverageReport,
  type CoverageCapabilityId,
  type CoverageLimitReason,
  type CoverageSignals,
} from "./application/capability-coverage.js";

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

export {
  DANGEROUS_RUNTIME_ACTION_RE,
  isDangerousRuntimeAction,
  isSafeRuntimeInteractionCandidate,
  type RuntimeInteractionCandidate,
} from "./domain/runtime/safe-action-policy.js";

export type {
  RuntimeObserverCrawlResult,
  RuntimeObserverIssue,
  RuntimeObserverIssueCode,
  RuntimeObserverRouteSnapshot,
  RuntimeObserverStateCapture,
  RuntimeObserverSummary,
  RuntimeObserverTrigger,
  RuntimeObserverVerifiedEdge,
} from "./domain/runtime/crawl-result.js";

export {
  RUNTIME_OBSERVER_CAPABILITY,
  RUNTIME_OBSERVER_DETECTOR_ID,
  type RuntimeEvidenceProvider,
  type RuntimeObserverRunRequest,
} from "./domain/runtime/runtime-observer-port.js";

export {
  normalizeRuntimeEvidence,
  type NormalizeRuntimeEvidenceInput,
  type NormalizeRuntimeEvidenceResult,
} from "./application/normalize-runtime-evidence.js";

export {
  createRuntimeObserverDetector,
  type CreateRuntimeObserverDetectorOptions,
} from "./application/create-runtime-observer-detector.js";

export {
  adaptLegacyScreensToUiGraph,
  type AdaptLegacyScreensInput,
} from "./application/adapt-legacy-screens-to-ui-graph.js";

export { projectUiGraphToLegacyScreens } from "./application/project-ui-graph-to-legacy-screens.js";

export {
  fuseRuntimeIntoUiGraph,
  type FuseRuntimeIntoUiGraphInput,
} from "./application/fuse-runtime-into-ui-graph.js";

export {
  uiGraphToScanFacts,
  type UiGraphFactBundle,
} from "./application/ui-graph-to-scan-facts.js";

export {
  createWebUiDetector,
  WEB_UI_CAPABILITY,
  WEB_UI_DETECTOR_ID,
  type WebUiDetectorHost,
} from "./application/create-web-ui-detector.js";

export type {
  LegacyScreenEdgeTrigger,
  LegacyScreenLike,
  LegacyScreenType,
  LegacyStateTarget,
  UiEvidenceOrigin,
  UiEvidenceRef,
  UiInteractionGraph,
  UiKnowledgeStatus,
  UiSurface,
  UiSurfaceKind,
  UiTransition,
  UiTransitionKind,
  UiTrigger,
} from "../ui-interaction-graph.types.js";

export {
  APPFLOW_ANALYSIS_MODES,
  DEFAULT_APPFLOW_ANALYSIS_MODE,
  isAppflowAnalysisMode,
  parseAppflowAnalysisMode,
  type AppflowAnalysisMode,
} from "./domain/appflow-analysis-mode.js";

export {
  projectUiGraphToAppflow,
  type AppflowProjectionEdge,
  type AppflowProjectionEdgeType,
  type AppflowProjectionModel,
} from "./application/project-ui-graph-to-appflow.js";

export {
  resolveAppflowAnalysis,
  type AppflowAnalysisSource,
  type AppflowLegacyFlowLike,
  type AppflowParityResult,
  type ResolveAppflowAnalysisInput,
  type ResolveAppflowAnalysisResult,
} from "./application/resolve-appflow-analysis.js";

export {
  DATA_ANALYSIS_MODES,
  DEFAULT_DATA_ANALYSIS_MODE,
  isDataAnalysisMode,
  parseDataAnalysisMode,
  type DataAnalysisMode,
} from "./domain/data-analysis-mode.js";

export {
  adaptErdToDataGraph,
  type AdaptErdToDataGraphInput,
} from "./application/adapt-erd-to-data-graph.js";

export { projectDataGraphToErd } from "./application/project-data-graph-to-erd.js";

export {
  dataGraphToScanFacts,
  type DataGraphFactBundle,
} from "./application/data-graph-to-scan-facts.js";

export {
  createSchemaDataDetector,
  SCHEMA_DATA_CAPABILITY,
  SCHEMA_DATA_DETECTOR_ID,
  type SchemaDataDetectorHost,
} from "./application/create-schema-data-detector.js";

export {
  resolveDataAnalysis,
  type DataAnalysisSource,
  type DataParityResult,
  type ResolveDataAnalysisInput,
  type ResolveDataAnalysisResult,
} from "./application/resolve-data-analysis.js";

export type {
  DataColumn,
  DataDatabase,
  DataEvidenceOrigin,
  DataEvidenceRef,
  DataGraph,
  DataKnowledgeStatus,
  DataPolicy,
  DataProvenanceKind,
  DataRelation,
  DataSchemaNode,
  DataTable,
  LegacyErdColumn,
  LegacyErdRelation,
  LegacyErdSnapshot,
  LegacyErdTable,
} from "../data-graph.types.js";

export type {
  DataLineageGraph,
  DataLineageLayer,
  DataLineagePath,
  LineageEntityRef,
  LineageHop,
  LineageHopEvidence,
  LineagePathStatus,
} from "../data-lineage.types.js";

/** SDE-13 — versioned snapshots, cache, incremental analysis */
export type {
  DetectorDependencyRule,
  HistoricalSnapshotQuery,
  HistoricalSnapshotRecord,
  IncrementalDecision,
  IncrementalPlan,
  ScanCacheEntry,
  ScanCacheIndexEntry,
  SnapshotKeyParts,
} from "./domain/snapshot/types.js";

export type { ScanCacheStore } from "./domain/cache/cache-store.js";

export {
  buildSnapshotKey,
  dirtyFingerprintForCleanTree,
  fingerprintFromPathDigests,
  projectIdFromSnapshotKey,
} from "./domain/snapshot/snapshot-key.js";

export {
  isDetectorVersionCompatible,
  isSnapshotCompatible,
} from "./domain/snapshot/compatibility.js";

export {
  DEFAULT_DETECTOR_DEPENDENCY_RULES,
  detectorInvalidatedByPaths,
  planIncrementalScan,
  ruleForDetector,
  type PlanIncrementalScanInput,
} from "./domain/snapshot/invalidation.js";

export { MemoryScanCacheStore } from "./application/memory-cache-store.js";

export { readHistoricalSnapshots } from "./application/historical-snapshot-read.js";

export {
  runWithCache,
  type RunWithCacheInput,
  type RunWithCacheResult,
} from "./application/run-with-cache.js";

/** SDE-14 — Local/Cloud shared engine host cutover */
export {
  applyEngineHostCutover,
  CLOUD_ENGINE_CAPABILITIES_ABSENT,
  CLOUD_ENGINE_CAPABILITIES_PRESENT,
  type EngineHostCutoverInput,
  type EngineHostCutoverResult,
  type EngineHostKind,
} from "./application/apply-engine-host-cutover.js";

/** PR-16 — Local vs GitHub semantic parity under shared capabilities */
export {
  compareLocalGithubParity,
  listParityEnabledProjectIds,
  type CapabilityDelta,
  type LocalGithubParityInput,
  type LocalGithubParityResult,
} from "./application/local-github-parity.js";

/** PR-21 — Evidence-backed cross-layer DataLineage */
export { buildDataLineage, type BuildDataLineageInput } from "./application/build-data-lineage.js";
