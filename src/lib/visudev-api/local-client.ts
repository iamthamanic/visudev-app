/**
 * Local Engine HTTP client for VisuDEV frontend.
 * Location: src/lib/visudev-api/local-client.ts
 */

import type { Project } from "../visudev/types";
import type { VisuDevApiClient } from "./client";
import { VisuDevApiError } from "./errors";
import type {
  AnalysisRunStatus,
  AnalyzeProjectRequest,
  ApiResponse,
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
  LocalVisuDevProject,
  PreviewStartResult,
  PreviewStatusResult,
  PreviewStopResult,
  GitSummary,
  GitBranchDiff,
  StartAnalysisResponse,
  StartPreviewInput,
  UpdateProjectInput,
  VisuDevCapabilities,
  VisuDevHealth,
} from "./types";

const ENGINE_URL =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_VISUDEV_ENGINE_URL) ||
  "http://localhost:4317";

function normalizeGithubRepo(value?: string): string | undefined {
  if (!value) return undefined;
  if (/^[\w.-]+\/[\w.-]+$/.test(value)) return value;
  const match = value.match(/github\.com[:/](?<owner>[^/]+)\/(?<repo>[^/.]+)(\.git)?/);
  if (!match?.groups) return undefined;
  return `${match.groups.owner}/${match.groups.repo}`;
}

function mapLocalProject(project: LocalVisuDevProject): Project {
  return {
    id: project.id,
    name: project.name,
    local_path: project.localPath,
    github_repo: normalizeGithubRepo(project.repositoryUrl),
    source_mode: project.localPath ? "local" : "github",
    blueprint_provider_id: project.blueprintProviderId,
    screens: [],
    flows: [],
    preview_mode: "local",
    database_type: "none",
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    previewUrl: project.preview?.lastPreviewUrl,
    previewStatus: project.preview?.status,
  };
}

async function request<T>(pathname: string, init?: RequestInit): Promise<T> {
  const base = ENGINE_URL.replace(/\/$/, "");
  let response: Response;
  try {
    response = await fetch(`${base}${pathname}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
  } catch (error) {
    throw new VisuDevApiError(
      `Local Engine is not reachable at ${base}.`,
      "ENGINE_UNREACHABLE",
      "local",
      error,
    );
  }

  const text = await response.text();
  let payload: ApiResponse<T>;
  try {
    payload = text
      ? (JSON.parse(text) as ApiResponse<T>)
      : { ok: false, error: { code: "EMPTY_RESPONSE", message: "Empty response" } };
  } catch {
    throw new VisuDevApiError("Local Engine returned invalid JSON.", "INVALID_JSON", "local", {
      status: response.status,
      body: text.slice(0, 200),
    });
  }

  if (!payload.ok) {
    throw new VisuDevApiError(
      payload.error.message,
      payload.error.code,
      "local",
      payload.error.details,
    );
  }

  return payload.data;
}

export class LocalVisuDevClient implements VisuDevApiClient {
  getMode() {
    return "local" as const;
  }

  async getHealth(): Promise<VisuDevHealth> {
    return request<VisuDevHealth>("/health?details=1");
  }

  async getCapabilities(): Promise<VisuDevCapabilities> {
    return request<VisuDevCapabilities>("/api/capabilities");
  }

  async listProjects(): Promise<Project[]> {
    const projects = await request<LocalVisuDevProject[]>("/api/projects");
    return projects.map(mapLocalProject);
  }

  async createProject(input: CreateProjectInput): Promise<Project> {
    const project = await request<LocalVisuDevProject>("/api/projects", {
      method: "POST",
      body: JSON.stringify(input),
    });
    return mapLocalProject(project);
  }

  async getProject(projectId: string): Promise<Project> {
    const project = await request<LocalVisuDevProject>(
      `/api/projects/${encodeURIComponent(projectId)}`,
    );
    return mapLocalProject(project);
  }

  async updateProject(projectId: string, input: UpdateProjectInput): Promise<Project> {
    const project = await request<LocalVisuDevProject>(
      `/api/projects/${encodeURIComponent(projectId)}`,
      {
        method: "PATCH",
        body: JSON.stringify(input),
      },
    );
    return mapLocalProject(project);
  }

  async deleteProject(projectId: string): Promise<void> {
    await request<{ deleted: boolean }>(`/api/projects/${encodeURIComponent(projectId)}`, {
      method: "DELETE",
    });
  }

  async startAnalysis(
    projectId: string,
    input: AnalyzeProjectRequest,
  ): Promise<StartAnalysisResponse> {
    return request<StartAnalysisResponse>(
      `/api/projects/${encodeURIComponent(projectId)}/analyze`,
      {
        method: "POST",
        body: JSON.stringify(input),
      },
    );
  }

  async getAnalysisStatus(projectId: string, runId: string): Promise<AnalysisRunStatus> {
    return request<AnalysisRunStatus>(
      `/api/projects/${encodeURIComponent(projectId)}/analyze/${encodeURIComponent(runId)}`,
    );
  }

  async getAnalysisResult(projectId: string, runId: string): Promise<LocalEngineAnalysisResult> {
    return request<LocalEngineAnalysisResult>(
      `/api/projects/${encodeURIComponent(projectId)}/analyze/${encodeURIComponent(runId)}/result`,
    );
  }

  async getBlueprintLatest(projectId: string): Promise<LocalBlueprintLatest | null> {
    return request<LocalBlueprintLatest | null>(
      `/api/projects/${encodeURIComponent(projectId)}/blueprint/latest`,
    );
  }

  async getAppflowLatest(projectId: string): Promise<LocalAppflowLatest | null> {
    return request<LocalAppflowLatest | null>(
      `/api/projects/${encodeURIComponent(projectId)}/appflow/latest`,
    );
  }

  async getDataLatest(projectId: string): Promise<LocalDataLatest | null> {
    return request<LocalDataLatest | null>(
      `/api/projects/${encodeURIComponent(projectId)}/data/latest`,
    );
  }

  async getGitSummary(projectId: string): Promise<GitSummary> {
    return request<GitSummary>(`/api/projects/${encodeURIComponent(projectId)}/git/summary`);
  }

  async getGitBranchDiff(projectId: string, base: string, head: string): Promise<GitBranchDiff> {
    const params = new URLSearchParams({ base, head });
    return request<GitBranchDiff>(
      `/api/projects/${encodeURIComponent(projectId)}/git/diff?${params.toString()}`,
    );
  }

  async startPreview(
    projectId: string,
    input: StartPreviewInput = { projectId },
  ): Promise<PreviewStartResult> {
    return request<PreviewStartResult>(
      `/api/projects/${encodeURIComponent(projectId)}/preview/start`,
      {
        method: "POST",
        body: JSON.stringify({ ...input, projectId }),
      },
    );
  }

  async getPreviewStatus(projectId: string): Promise<PreviewStatusResult> {
    return request<PreviewStatusResult>(
      `/api/projects/${encodeURIComponent(projectId)}/preview/status`,
    );
  }

  async stopPreview(projectId: string): Promise<PreviewStopResult> {
    return request<PreviewStopResult>(
      `/api/projects/${encodeURIComponent(projectId)}/preview/stop`,
      {
        method: "POST",
        body: "{}",
      },
    );
  }

  async crawlPreview(projectId: string, input: CrawlPreviewInput): Promise<CrawlPreviewResult> {
    return request<CrawlPreviewResult>(
      `/api/projects/${encodeURIComponent(projectId)}/preview/crawl`,
      {
        method: "POST",
        body: JSON.stringify(input),
      },
    );
  }

  async getRuntimeLatest(projectId: string): Promise<LocalRuntimeLatest | null> {
    return request<LocalRuntimeLatest | null>(
      `/api/projects/${encodeURIComponent(projectId)}/runtime/latest`,
    );
  }

  async browseLocalPath(input: BrowseLocalPathInput = {}): Promise<BrowseLocalPathResult> {
    const qs = input.startDir ? `?startDir=${encodeURIComponent(input.startDir)}` : "";
    return request<BrowseLocalPathResult>(`/api/local-path/browse${qs}`);
  }
}
