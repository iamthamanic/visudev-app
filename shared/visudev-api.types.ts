/**
 * Shared VisuDEV API types for Local Engine and Frontend clients.
 * Location: shared/visudev-api.types.ts
 */

import type { AnalysisOrigin } from "./software-graph.types.js";

export type VisuDevMode = "local" | "supabase" | "hybrid";

export type ApiSuccess<T> = {
  ok: true;
  data: T;
};

export type ApiFailure = {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export type AnalysisStatus = "queued" | "running" | "success" | "partial" | "failed";

export type BlueprintAnalysisProviderId = "legacy-blueprint-runner" | "autoguide";

export type LocalVisuDevProject = {
  id: string;
  name: string;
  repositoryUrl?: string;
  localPath?: string;
  blueprintProviderId?: BlueprintAnalysisProviderId;
  createdAt: string;
  updatedAt: string;
  source: "local";
  preview?: {
    lastRunId?: string;
    lastPreviewUrl?: string;
    status?: "idle" | "starting" | "ready" | "failed" | "stopped";
    updatedAt?: string;
  };
  analysis?: {
    latestBlueprintRunId?: string;
    latestBlueprintStatus?: AnalysisStatus;
    latestAppflowRunId?: string;
    latestAppflowStatus?: AnalysisStatus;
    latestDataRunId?: string;
    latestDataStatus?: AnalysisStatus;
    updatedAt?: string;
  };
};

export type ProjectsIndex = {
  version: 1;
  projects: LocalVisuDevProject[];
};

export type CreateProjectInput = {
  name: string;
  repositoryUrl?: string;
  localPath?: string;
  blueprintProviderId?: BlueprintAnalysisProviderId;
};

export type UpdateProjectInput = {
  name?: string;
  repositoryUrl?: string | null;
  localPath?: string | null;
  blueprintProviderId?: BlueprintAnalysisProviderId | null;
};

export type AnalyzeProjectRequest = {
  scanType: "blueprint" | "appflow" | "data" | "all";
  localPath?: string;
  repositoryUrl?: string;
  branchOrCommit?: string;
};

export type SupportedScanType = "blueprint" | "appflow" | "data";

export type AnalysisChildRunStatus = {
  scanType: SupportedScanType;
  runId: string;
  status: AnalysisStatus;
  error?: ApiFailure["error"];
};

export type StartAnalysisResponse = {
  projectId: string;
  runId: string;
  scanType: SupportedScanType | "all";
  status: "queued" | "running";
  statusUrl: string;
  resultUrl: string;
  childRuns?: AnalysisChildRunStatus[];
};

export type AnalysisRunStatus = {
  projectId: string;
  runId: string;
  scanType: string;
  status: AnalysisStatus;
  startedAt?: string;
  finishedAt?: string;
  error?: ApiFailure["error"];
  children?: AnalysisChildRunStatus[];
};

import type {
  SoftwareGraph,
  SoftwareGraphEdge,
  SoftwareGraphEdgeKind,
  SoftwareGraphEvidence,
  SoftwareGraphGroup,
  SoftwareGraphMetric,
  SoftwareGraphNode,
  SoftwareGraphNodeKind,
  SoftwareGraphScope,
  SoftwareGraphScopeLevel,
} from "./software-graph.types.js";

export type BlueprintDocument = Record<string, unknown> & {
  /** Optional neutral Software Graph IR for Blueprint v2 views. */
  graph?: SoftwareGraph;
};

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
};

export type RawBlueprintRoute = {
  id: string;
  method: string;
  path: string;
  filePath: string;
  line: number;
  pipeline?: unknown[];
  concepts?: Record<string, unknown>;
};

export type RawBlueprintFact = {
  id: string;
  kind: string;
  filePath: string;
  line: number;
  snippet: string;
  metadata?: Record<string, unknown>;
};

export type RawBlueprintScan = {
  providerId: BlueprintAnalysisProviderId;
  projectId: string;
  localPath: string;
  analyzedAt: string;
  routes: RawBlueprintRoute[];
  facts: RawBlueprintFact[];
  filesAnalyzed: number;
  /** Captured at scan time by the provider; avoids re-reading git after analysis. */
  analysisOrigin?: AnalysisOrigin;
  providerMetadata?: Record<string, unknown>;
};

export type LocalBlueprintAnalysisResult = {
  kind: "blueprint";
  projectId: string;
  runId: string;
  providerId: BlueprintAnalysisProviderId;
  status: "success" | "partial" | "failed";
  createdAt: string;
  summary: {
    routesDetected: number;
    findings: number;
    filesAnalyzed?: number;
    warnings: number;
    errors: number;
  };
  blueprint: BlueprintDocument;
  raw?: unknown;
};

export type LocalAppflowAnalysisResult = {
  kind: "appflow";
  projectId: string;
  runId: string;
  providerId: "legacy-appflow-runner";
  status: "success" | "partial" | "failed";
  createdAt: string;
  summary: {
    screensDetected: number;
    flowsDetected: number;
    filesAnalyzed?: number;
    warnings: number;
    errors: number;
  };
  screens: unknown[];
  flows: unknown[];
  graph?: unknown;
  quality?: unknown;
  framework?: unknown;
  commitSha?: string;
  raw?: unknown;
};

export type LocalErdDocument = {
  projectId: string;
  updatedAt: string;
  nodes: unknown[];
  tables: unknown[];
  message?: string;
  dialect?: "postgres" | "sqlite";
  source?: string;
};

export type LocalDataAnalysisResult = {
  kind: "data";
  projectId: string;
  runId: string;
  providerId: "local-data-introspection";
  status: "success" | "partial" | "failed";
  createdAt: string;
  summary: {
    tablesDetected: number;
    columnsDetected: number;
    warnings: number;
    errors: number;
  };
  erd: LocalErdDocument;
  raw?: unknown;
};

export type LocalUnsupportedAnalysisResult = {
  kind: "unsupported";
  scanType: string;
  message: string;
};

export type LocalFailedAnalysisResult = {
  kind: "failed";
  projectId: string;
  runId: string;
  status: "failed";
  error: ApiFailure["error"];
};

export type LocalAllAnalysisResult = {
  kind: "all";
  projectId: string;
  runId: string;
  status: "success" | "partial" | "failed";
  createdAt: string;
  summary: {
    blueprint: AnalysisStatus;
    appflow: AnalysisStatus;
    data: AnalysisStatus;
    warnings: number;
    errors: number;
  };
  children: {
    blueprint?: LocalBlueprintAnalysisResult;
    appflow?: LocalAppflowAnalysisResult;
    data?: LocalDataAnalysisResult;
  };
};

export type LocalEngineAnalysisResult =
  | LocalBlueprintAnalysisResult
  | LocalAppflowAnalysisResult
  | LocalDataAnalysisResult
  | LocalAllAnalysisResult
  | LocalUnsupportedAnalysisResult
  | LocalFailedAnalysisResult;

export type LocalBlueprintLatest = {
  projectId: string;
  runId: string;
  blueprint: BlueprintDocument;
  updatedAt: string;
};

export type LocalAppflowLatest = {
  projectId: string;
  runId: string;
  screens: unknown[];
  flows: unknown[];
  graph?: unknown;
  quality?: unknown;
  framework?: unknown;
  commitSha?: string;
  runtime?: unknown;
  updatedAt: string;
};

export type LocalDataLatest = {
  projectId: string;
  runId: string;
  nodes: unknown[];
  tables: unknown[];
  message?: string;
  dialect?: "postgres" | "sqlite";
  source?: string;
  updatedAt: string;
};

export type CrawlPreviewScreenInput = {
  id: string;
  name: string;
  path: string;
  type?: string;
  parentScreenId?: string;
  parentPath?: string;
  stateKey?: string;
};

export type CrawlPreviewInput = {
  screens: CrawlPreviewScreenInput[];
  maxScreens?: number;
  maxClicksPerScreen?: number;
};

export type CrawlPreviewResult = {
  projectId: string;
  previewRunId: string;
  runtime: Record<string, unknown>;
  screens: unknown[];
  updatedAt: string;
};

export type LocalRuntimeLatest = {
  projectId: string;
  previewRunId: string;
  runtime: Record<string, unknown>;
  updatedAt: string;
};

export type StartPreviewInput = {
  projectId: string;
  repo?: string;
  repositoryUrl?: string;
  localPath?: string;
  branchOrCommit?: string;
  commitSha?: string;
  bootMode?: "best_effort" | "strict";
  injectSupabasePlaceholders?: boolean | null;
};

export type PreviewStartResult = {
  projectId: string;
  runId: string;
  status: "starting" | "ready" | "failed";
  previewUrl?: string;
  reusedExistingRun?: boolean;
};

export type PreviewStatusResult = {
  projectId: string;
  runId?: string;
  status: "idle" | "starting" | "ready" | "failed" | "stopped";
  previewUrl?: string;
  error?: ApiFailure["error"];
};

export type PreviewStopResult = {
  projectId: string;
  status: "stopped" | "failed" | "not_implemented";
  error?: ApiFailure["error"];
};

export type BrowseLocalPathInput = {
  startDir?: string;
};

export type BrowseLocalPathResult =
  | { cancelled: true; path?: never; displayPath?: never }
  | { cancelled: false; path: string; displayPath: string };

export interface GitSummaryCommit {
  sha: string;
  subject: string;
  committedAt: string;
}

export interface GitSummaryBranch {
  name: string;
  headSha: string;
}

export interface GitWorkingTreeStatus {
  modified: string[];
  added: string[];
  deleted: string[];
}

export interface GitSummary {
  initialized: boolean;
  shallow: boolean;
  currentRef?: string;
  currentSha?: string;
  commits: GitSummaryCommit[];
  branches: GitSummaryBranch[];
  workingTree: GitWorkingTreeStatus;
  /** Non-fatal git command failures surfaced to callers. */
  warnings?: string[];
  /** True when some git sections could not be read. */
  partial?: boolean;
}

export type VisuDevHealth = {
  ok: boolean;
  service: string;
  mode: VisuDevMode;
  version: string;
  dependencies?: {
    previewRunner?: { reachable: boolean; url: string };
    deno?: { available: boolean; version: string | null; requiredFor: string[] };
  };
};

export type VisuDevCapabilities = {
  mode: VisuDevMode;
  scans: {
    blueprint: boolean;
    appflow: boolean;
    data: boolean;
    all: boolean;
  };
  preview: boolean;
  browseLocalPath: boolean;
};

export type LocalPreviewMapping = {
  projectId: string;
  runId: string;
  projectToken?: string;
  runnerUrl: string;
  previewUrl?: string;
  status: "starting" | "ready" | "failed" | "stopped" | "idle";
  startedAt: string;
  updatedAt: string;
  input: {
    repo?: string;
    repositoryUrl?: string;
    localPath?: string;
    branchOrCommit?: string;
    commitSha?: string;
    bootMode?: "best_effort" | "strict";
    injectSupabasePlaceholders?: boolean | null;
  };
};

export type EngineParentAnalysisRun = {
  runId: string;
  projectId: string;
  scanType: "all";
  status: AnalysisStatus;
  childRuns: AnalysisChildRunStatus[];
  createdAt: string;
  updatedAt: string;
  error?: ApiFailure["error"];
};

export type EngineAnalysisRun = {
  runId: string;
  projectId: string;
  scanType: SupportedScanType;
  providerId:
    | BlueprintAnalysisProviderId
    | "legacy-appflow-runner"
    | "local-data-introspection"
    | "autoguide-stub";
  runnerAnalysisId?: string;
  status: AnalysisStatus;
  createdAt: string;
  updatedAt: string;
  error?: ApiFailure["error"];
};

export type EngineAnalysisRunRecord = EngineAnalysisRun | EngineParentAnalysisRun;
