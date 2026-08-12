/**
 * Re-export shared API types for Local Engine.
 * Location: local-engine/src/types/api.types.ts
 */

export type {
  AnalysisRunStatus,
  AnalysisStatus,
  AnalyzeProjectRequest,
  AnalysisChildRunStatus,
  ApiFailure,
  ApiResponse,
  ApiSuccess,
  BlueprintAnalysisProviderId,
  BlueprintDocument,
  EngineAnalysisRunRecord,
  EngineParentAnalysisRun,
  LocalAllAnalysisResult,
  SupportedScanType,
  CrawlPreviewInput,
  CrawlPreviewResult,
  CreateProjectInput,
  EngineAnalysisRun,
  LocalAppflowAnalysisResult,
  LocalAppflowLatest,
  LocalBlueprintAnalysisResult,
  LocalBlueprintLatest,
  LocalDataAnalysisResult,
  LocalDataLatest,
  LocalEngineAnalysisResult,
  LocalPreviewMapping,
  LocalRuntimeLatest,
  LocalVisuDevProject,
  PreviewStartResult,
  PreviewStatusResult,
  PreviewStopResult,
  ProjectsIndex,
  RawBlueprintFact,
  RawBlueprintRoute,
  RawBlueprintScan,
  FactSelectionReport,
  StartAnalysisResponse,
  StartPreviewInput,
  UpdateProjectInput,
  VisuDevCapabilities,
  VisuDevHealth,
  VisuDevMode,
} from "../../../shared/visudev-api.types.js";

export type {
  ExportSupabaseProjectInput,
  ImportLocalBundleInput,
  ImportSupabaseBundleInput,
  MigrationResult,
  ProjectMigrationArtifacts,
  ProjectMigrationBundle,
  ProjectMigrationMetadata,
} from "../../../shared/project-migration.types.js";

export type {
  SoftwareGraph,
  SoftwareGraphScope,
  SoftwareGraphScopeLevel,
  SoftwareGraphNode,
  SoftwareGraphNodeKind,
  SoftwareGraphEdge,
  SoftwareGraphEdgeKind,
  SoftwareGraphEvidence,
  SoftwareGraphGroup,
  SoftwareGraphMetric,
  SoftwareGraphSnapshot,
} from "../../../shared/software-graph.types.js";

export type {
  GitSummary,
  GitSummaryBranch,
  GitSummaryCommit,
  GitWorkingTreeStatus,
} from "../../../shared/visudev-api.types.js";
