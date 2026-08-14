/**
 * Shared VisuDEV API types (re-export from shared/).
 * Location: src/lib/visudev-api/types.ts
 */

export type {
  AnalysisRunStatus,
  AnalysisStatus,
  AnalyzeProjectRequest,
  ApiFailure,
  ApiResponse,
  ApiSuccess,
  BlueprintDocument,
  BrowseLocalPathInput,
  BrowseLocalPathResult,
  CrawlPreviewInput,
  CrawlPreviewResult,
  CreateProjectInput,
  LocalAppflowAnalysisResult,
  LocalAppflowLatest,
  LocalBlueprintAnalysisResult,
  LocalBlueprintLatest,
  LocalDataAnalysisResult,
  LocalDataLatest,
  LocalEngineAnalysisResult,
  LocalRuntimeLatest,
  LocalVisuDevProject,
  PreviewStartResult,
  PreviewStatusResult,
  PreviewStopResult,
  StartAnalysisResponse,
  StartPreviewInput,
  UpdateProjectInput,
  VisuDevCapabilities,
  VisuDevHealth,
  VisuDevMode,
  GitSummary,
  GitSummaryBranch,
  GitSummaryCommit,
  GitWorkingTreeStatus,
  GitBranchDiff,
  GitBranchDiffFile,
} from "../../../shared/visudev-api.types";

import type { Project } from "../visudev/types";

export type LocalProjectDto = Project & { source: "local" };
