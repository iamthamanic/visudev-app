/**
 * Supabase/Legacy API client implementing VisuDevApiClient parity.
 * Location: src/lib/visudev-api/supabase-client.ts
 */

import { api, previewAPI } from "../../utils/api";
import { runBlueprintScan, BlueprintScanError } from "../visudev/blueprint-scan";
import { browseLocalFolderViaRunner } from "../../utils/preview-runner-browse-path";
import type { Project, PreviewMode } from "../visudev/types";
import type { ProjectCreateInput, ProjectUpdateInput } from "../../modules/projects";
import type { VisuDevApiClient } from "./client";
import { VisuDevApiError } from "./errors";
import type {
  AnalysisRunStatus,
  AnalyzeProjectRequest,
  BrowseLocalPathInput,
  BrowseLocalPathResult,
  CreateProjectInput,
  LocalBlueprintLatest,
  LocalEngineAnalysisResult,
  PreviewStartResult,
  PreviewStatusResult,
  PreviewStopResult,
  StartAnalysisResponse,
  StartPreviewInput,
  UpdateProjectInput,
  VisuDevCapabilities,
  VisuDevHealth,
} from "./types";
import { blueprintAPI } from "../../utils/api";

type SupabaseRunRecord = {
  projectId: string;
  scanType: string;
  status: AnalysisRunStatus["status"];
  result?: LocalEngineAnalysisResult;
  error?: { code: string; message: string };
};

const runCache = new Map<string, SupabaseRunRecord>();

function createRunId(): string {
  return `supabase_run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function toProjectCreateInput(input: CreateProjectInput): ProjectCreateInput {
  return {
    name: input.name,
    local_path: input.localPath,
    github_repo: input.repositoryUrl,
    source_mode: input.localPath ? "local" : "github",
    preview_mode: "auto",
    database_type: "supabase",
  };
}

function toProjectUpdateInput(input: UpdateProjectInput): ProjectUpdateInput {
  return {
    name: input.name,
    local_path: input.localPath === null ? undefined : input.localPath,
    github_repo: input.repositoryUrl === null ? undefined : input.repositoryUrl,
  };
}

function wrapApiError(error: unknown, code = "SUPABASE_API_ERROR"): never {
  const message =
    typeof error === "string"
      ? error
      : error instanceof Error
        ? error.message
        : "Supabase request failed";
  throw new VisuDevApiError(message, code, "supabase", error);
}

export class SupabaseVisuDevClient implements VisuDevApiClient {
  private accessToken: string | null = null;

  setAccessToken(token: string | null): void {
    this.accessToken = token;
  }

  getMode() {
    return "supabase" as const;
  }

  async getHealth(): Promise<VisuDevHealth> {
    return {
      ok: true,
      service: "visudev-supabase-legacy",
      mode: "supabase",
      version: "legacy",
    };
  }

  async getCapabilities(): Promise<VisuDevCapabilities> {
    return {
      mode: "supabase",
      scans: { blueprint: true, appflow: true, data: true, all: true },
      preview: true,
      browseLocalPath: true,
    };
  }

  async listProjects(): Promise<Project[]> {
    const res = await api.projects.getAll();
    if (!res.success || !res.data) wrapApiError(res.error);
    return res.data;
  }

  async createProject(input: CreateProjectInput | ProjectCreateInput): Promise<Project> {
    const payload =
      "source_mode" in input || "preview_mode" in input
        ? (input as ProjectCreateInput)
        : toProjectCreateInput(input);
    const res = await api.projects.create(payload);
    if (!res.success || !res.data) wrapApiError(res.error);
    return res.data;
  }

  async getProject(projectId: string): Promise<Project> {
    const res = await api.projects.get(projectId);
    if (!res.success || !res.data) wrapApiError(res.error);
    return res.data;
  }

  async updateProject(
    projectId: string,
    input: UpdateProjectInput & Partial<ProjectUpdateInput>,
  ): Promise<Project> {
    const payload =
      "local_path" in input || "github_repo" in input || "preview_mode" in input
        ? (input as ProjectUpdateInput)
        : toProjectUpdateInput(input);
    const res = await api.projects.update(projectId, payload);
    if (!res.success || !res.data) wrapApiError(res.error);
    return res.data as Project;
  }

  async deleteProject(projectId: string): Promise<void> {
    const res = await api.projects.delete(projectId);
    if (!res.success) wrapApiError(res.error);
  }

  async startAnalysis(
    projectId: string,
    input: AnalyzeProjectRequest,
  ): Promise<StartAnalysisResponse> {
    if (input.scanType !== "blueprint") {
      throw new VisuDevApiError(
        `Scan type "${input.scanType}" should use legacy store flows in supabase mode.`,
        "NOT_IMPLEMENTED_SUPABASE_SCAN_BRIDGE",
        "supabase",
      );
    }

    const project = await this.getProject(projectId);
    const runId = createRunId();
    runCache.set(runId, {
      projectId,
      scanType: input.scanType,
      status: "running",
    });

    void (async () => {
      try {
        const scanResult = await runBlueprintScan(project, this.accessToken);
        runCache.set(runId, {
          projectId,
          scanType: input.scanType,
          status: "success",
          result: {
            kind: "blueprint",
            projectId,
            runId,
            providerId: "legacy-blueprint-runner",
            status: "success",
            createdAt: new Date().toISOString(),
            summary: {
              routesDetected: scanResult.routeCount,
              findings: scanResult.findingCount,
              warnings: 0,
              errors: 0,
            },
            blueprint: scanResult.blueprint,
          },
        });
      } catch (error: unknown) {
        const message =
          error instanceof BlueprintScanError
            ? error.message
            : error instanceof Error
              ? error.message
              : "Blueprint scan failed";
        runCache.set(runId, {
          projectId,
          scanType: input.scanType,
          status: "failed",
          error: { code: "BLUEPRINT_SCAN_FAILED", message },
        });
      }
    })();

    return {
      projectId,
      runId,
      scanType: "blueprint",
      status: "running",
      statusUrl: `supabase://${projectId}/analyze/${runId}`,
      resultUrl: `supabase://${projectId}/analyze/${runId}/result`,
    };
  }

  async getAnalysisStatus(projectId: string, runId: string): Promise<AnalysisRunStatus> {
    const record = runCache.get(runId);
    if (!record || record.projectId !== projectId) {
      throw new VisuDevApiError("Analysis run not found", "ANALYSIS_RUN_NOT_FOUND", "supabase");
    }
    return {
      projectId,
      runId,
      scanType: record.scanType,
      status: record.status,
      error: record.error,
    };
  }

  async getAnalysisResult(projectId: string, runId: string): Promise<LocalEngineAnalysisResult> {
    const record = runCache.get(runId);
    if (!record || record.projectId !== projectId) {
      throw new VisuDevApiError("Analysis run not found", "ANALYSIS_RUN_NOT_FOUND", "supabase");
    }
    if (record.status === "running") {
      return {
        kind: "failed",
        projectId,
        runId,
        status: "failed",
        error: { code: "ANALYSIS_NOT_READY", message: "Analysis is still running." },
      };
    }
    if (record.status === "failed" || !record.result) {
      return {
        kind: "failed",
        projectId,
        runId,
        status: "failed",
        error: record.error ?? { code: "ANALYSIS_FAILED", message: "Analysis failed." },
      };
    }
    return record.result;
  }

  async getBlueprintLatest(projectId: string): Promise<LocalBlueprintLatest | null> {
    const res = await blueprintAPI.get(projectId);
    if (!res.success || !res.data) return null;
    return {
      projectId,
      runId: "supabase-kv",
      blueprint: res.data as Record<string, unknown>,
      updatedAt: new Date().toISOString(),
    };
  }

  async getAppflowLatest(projectId: string): Promise<import("./types").LocalAppflowLatest | null> {
    void projectId;
    return null;
  }

  async getDataLatest(projectId: string): Promise<import("./types").LocalDataLatest | null> {
    void projectId;
    return null;
  }

  async getGitSummary(projectId: string): Promise<import("./types").GitSummary> {
    void projectId;
    return {
      initialized: false,
      shallow: false,
      commits: [],
      branches: [],
      workingTree: { modified: [], added: [], deleted: [] },
    };
  }

  async getGitBranchDiff(
    projectId: string,
    base: string,
    head: string,
  ): Promise<import("./types").GitBranchDiff> {
    void projectId;
    void base;
    void head;
    throw new VisuDevApiError(
      "Git branch diff is only available in local mode.",
      "UNSUPPORTED_MODE",
      "supabase",
    );
  }

  async startPreview(
    projectId: string,
    input: StartPreviewInput = { projectId },
  ): Promise<PreviewStartResult> {
    const project = await this.getProject(projectId);
    const previewMode = (project.preview_mode ?? "auto") as PreviewMode;
    const res = await previewAPI.start(
      projectId,
      {
        repo: input.repo ?? project.github_repo,
        localPath: input.localPath ?? project.local_path,
        branchOrCommit: input.branchOrCommit ?? project.github_branch,
        commitSha: input.commitSha,
        accessToken: this.accessToken ?? undefined,
      },
      previewMode,
    );
    if (!res.success || !res.data?.runId) {
      throw new VisuDevApiError(
        res.error ?? "Preview start failed",
        "PREVIEW_START_FAILED",
        "supabase",
      );
    }
    return {
      projectId,
      runId: res.data.runId,
      status: res.data.status === "ready" ? "ready" : "starting",
      reusedExistingRun: res.data.reusedExistingRun,
    };
  }

  async getPreviewStatus(projectId: string): Promise<PreviewStatusResult> {
    const project = await this.getProject(projectId);
    const res = await previewAPI.status(
      projectId,
      (project.preview_mode ?? "auto") as PreviewMode,
      this.accessToken ?? undefined,
    );
    if (!res.success) {
      throw new VisuDevApiError(
        res.error ?? "Preview status failed",
        "PREVIEW_STATUS_FAILED",
        "supabase",
      );
    }
    const data =
      "data" in res
        ? (res.data as {
            status?: PreviewStatusResult["status"];
            previewUrl?: string;
            runId?: string;
          })
        : undefined;
    return {
      projectId,
      runId: data?.runId,
      status: data?.status ?? "idle",
      previewUrl: data?.previewUrl,
    };
  }

  async stopPreview(projectId: string): Promise<PreviewStopResult> {
    const project = await this.getProject(projectId);
    const res = await previewAPI.stop(
      projectId,
      (project.preview_mode ?? "auto") as PreviewMode,
      this.accessToken ?? undefined,
    );
    if (!res.success) {
      throw new VisuDevApiError(
        res.error ?? "Preview stop failed",
        "PREVIEW_STOP_FAILED",
        "supabase",
      );
    }
    return { projectId, status: "stopped" };
  }

  async crawlPreview(
    projectId: string,
    input: import("./types").CrawlPreviewInput,
  ): Promise<import("./types").CrawlPreviewResult> {
    const project = await this.getProject(projectId);
    const res = await previewAPI.crawl(
      projectId,
      {
        screens: input.screens,
        maxScreens: input.maxScreens,
        maxClicksPerScreen: input.maxClicksPerScreen,
      },
      (project.preview_mode ?? "auto") as PreviewMode,
    );
    if (!res.success || !res.data) {
      throw new VisuDevApiError(res.error ?? "Crawl failed", "CRAWL_FAILED", "supabase");
    }
    return {
      projectId,
      previewRunId: "",
      runtime: res.data as unknown as Record<string, unknown>,
      screens: input.screens,
      updatedAt: new Date().toISOString(),
    };
  }

  async getRuntimeLatest(projectId: string): Promise<import("./types").LocalRuntimeLatest | null> {
    void projectId;
    return null;
  }

  async browseLocalPath(input: BrowseLocalPathInput = {}): Promise<BrowseLocalPathResult> {
    const result = await browseLocalFolderViaRunner(input.startDir);
    if (result.cancelled) return { cancelled: true };
    if (!result.success || !result.path) {
      throw new VisuDevApiError(
        result.error ?? "Folder browse failed",
        "BROWSE_LOCAL_PATH_FAILED",
        "supabase",
      );
    }
    return { cancelled: false, path: result.path, displayPath: result.path };
  }
}
