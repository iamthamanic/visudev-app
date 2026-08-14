/**
 * VisuDEV API client interface for local and supabase modes.
 * Location: src/lib/visudev-api/client.ts
 */

import type { Project } from "../visudev/types";
import type {
  AnalyzeProjectRequest,
  BrowseLocalPathInput,
  BrowseLocalPathResult,
  CrawlPreviewInput,
  CrawlPreviewResult,
  CreateProjectInput,
  LocalAppflowLatest,
  LocalBlueprintLatest,
  LocalDataLatest,
  LocalEngineAnalysisResult,
  LocalRuntimeLatest,
  PreviewStartResult,
  PreviewStatusResult,
  PreviewStopResult,
  StartAnalysisResponse,
  StartPreviewInput,
  UpdateProjectInput,
  VisuDevCapabilities,
  VisuDevHealth,
  VisuDevMode,
  AnalysisRunStatus,
  GitSummary,
  GitBranchDiff,
} from "./types";

export interface VisuDevApiClient {
  getMode(): VisuDevMode;
  getHealth(): Promise<VisuDevHealth>;
  getCapabilities(): Promise<VisuDevCapabilities>;

  listProjects(): Promise<Project[]>;
  createProject(input: CreateProjectInput): Promise<Project>;
  getProject(projectId: string): Promise<Project>;
  updateProject(projectId: string, input: UpdateProjectInput): Promise<Project>;
  deleteProject(projectId: string): Promise<void>;

  startAnalysis(projectId: string, input: AnalyzeProjectRequest): Promise<StartAnalysisResponse>;
  getAnalysisStatus(projectId: string, runId: string): Promise<AnalysisRunStatus>;
  getAnalysisResult(projectId: string, runId: string): Promise<LocalEngineAnalysisResult>;
  getBlueprintLatest(projectId: string): Promise<LocalBlueprintLatest | null>;
  getAppflowLatest(projectId: string): Promise<LocalAppflowLatest | null>;
  getDataLatest(projectId: string): Promise<LocalDataLatest | null>;
  getGitSummary(projectId: string): Promise<GitSummary>;
  getGitBranchDiff(projectId: string, base: string, head: string): Promise<GitBranchDiff>;

  startPreview(projectId: string, input?: StartPreviewInput): Promise<PreviewStartResult>;
  getPreviewStatus(projectId: string): Promise<PreviewStatusResult>;
  stopPreview(projectId: string): Promise<PreviewStopResult>;

  crawlPreview(projectId: string, input: CrawlPreviewInput): Promise<CrawlPreviewResult>;
  getRuntimeLatest(projectId: string): Promise<LocalRuntimeLatest | null>;

  browseLocalPath(input?: BrowseLocalPathInput): Promise<BrowseLocalPathResult>;
}
