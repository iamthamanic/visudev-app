/**
 * Preview Runner HTTP integration for Local Engine.
 * Location: local-engine/src/providers/local-preview-runner.provider.ts
 */

import path from "node:path";
import { appendJsonLog, readJsonFile, writeJsonFile } from "../storage/file-store.js";
import type {
  CrawlPreviewInput,
  CrawlPreviewResult,
  LocalPreviewMapping,
  LocalVisuDevProject,
  PreviewStartResult,
  PreviewStatusResult,
  PreviewStopResult,
  StartPreviewInput,
} from "../types/api.types.js";
import type { PreviewProvider } from "./preview-provider.js";

type RunnerStartBody = {
  projectId: string;
  repo?: string;
  localPath?: string;
  branchOrCommit?: string;
  commitSha?: string;
  bootMode?: "best_effort" | "strict";
  injectSupabasePlaceholders?: boolean | null;
};

function normalizeGithubRepo(value?: string): string | undefined {
  if (!value) return undefined;
  if (/^[\w.-]+\/[\w.-]+$/.test(value)) return value;
  const match = value.match(/github\.com[:/](?<owner>[^/]+)\/(?<repo>[^/.]+)(\.git)?/);
  if (!match?.groups) return undefined;
  return `${match.groups.owner}/${match.groups.repo}`;
}

function toRunnerStartBody(input: StartPreviewInput): RunnerStartBody {
  const base: RunnerStartBody = {
    projectId: input.projectId,
    branchOrCommit: input.branchOrCommit ?? "main",
    commitSha: input.commitSha,
    bootMode: input.bootMode ?? "best_effort",
    injectSupabasePlaceholders: input.injectSupabasePlaceholders ?? null,
  };

  if (input.localPath) {
    return { ...base, localPath: input.localPath };
  }

  const repo = input.repo ?? normalizeGithubRepo(input.repositoryUrl);
  if (!repo) {
    throw new Error("Preview start requires either localPath, repo, or repositoryUrl.");
  }
  return { ...base, repo };
}

export class LocalPreviewRunnerProvider implements PreviewProvider {
  readonly id = "local-preview-runner";
  readonly name = "Local Preview Runner";

  constructor(
    private readonly runnerUrl: string,
    private readonly storageDir: string,
    private readonly runnerSecret = "",
  ) {}

  private mappingPath(projectId: string): string {
    return path.join(this.storageDir, "previews", `${projectId}.json`);
  }

  private async readMapping(projectId: string): Promise<LocalPreviewMapping | null> {
    return readJsonFile<LocalPreviewMapping | null>(this.mappingPath(projectId), null);
  }

  private async writeMapping(mapping: LocalPreviewMapping): Promise<void> {
    await writeJsonFile(this.mappingPath(mapping.projectId), mapping);
  }

  private unavailable(error: PreviewStartResult | PreviewStatusResult | PreviewStopResult) {
    return error;
  }

  private mergeRunnerHeaders(init?: RequestInit): Record<string, string> {
    const headers: Record<string, string> = {};
    const raw = init?.headers;
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      for (const [key, value] of Object.entries(raw as Record<string, string>)) {
        if (typeof value === "string") headers[key] = value;
      }
    }
    if (this.runnerSecret) {
      headers["X-VisuDev-Runner-Secret"] = this.runnerSecret;
    }
    return headers;
  }

  private async runnerFetch(pathname: string, init?: RequestInit): Promise<Response> {
    const base = this.runnerUrl.replace(/\/$/, "");
    try {
      return await fetch(`${base}${pathname}`, {
        ...init,
        headers: this.mergeRunnerHeaders(init),
      });
    } catch {
      throw new Error(`Preview Runner is not reachable at ${base}`);
    }
  }

  async startPreview(
    input: StartPreviewInput,
    project: LocalVisuDevProject,
  ): Promise<PreviewStartResult> {
    try {
      await this.runnerFetch(`/stop-project/${encodeURIComponent(input.projectId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn("[preview] stop before start failed:", message);
      return {
        projectId: input.projectId,
        runId: "",
        status: "failed",
        previewUrl: undefined,
      };
    }

    const merged: StartPreviewInput = {
      ...input,
      localPath: input.localPath ?? project.localPath,
      repositoryUrl: input.repositoryUrl ?? project.repositoryUrl,
    };

    let body: RunnerStartBody;
    try {
      body = toRunnerStartBody(merged);
    } catch {
      return {
        projectId: input.projectId,
        runId: "",
        status: "failed",
      };
    }

    let response: Response;
    try {
      response = await this.runnerFetch("/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch {
      return {
        projectId: input.projectId,
        runId: "",
        status: "failed",
      };
    }

    const text = await response.text();
    let payload: {
      success?: boolean;
      runId?: string;
      status?: string;
      previewUrl?: string;
      projectToken?: string;
      reusedExistingRun?: boolean;
      error?: string;
    };
    try {
      payload = text ? (JSON.parse(text) as typeof payload) : {};
    } catch {
      return { projectId: input.projectId, runId: "", status: "failed" };
    }

    if (!response.ok || !payload.runId) {
      return { projectId: input.projectId, runId: "", status: "failed" };
    }

    const now = new Date().toISOString();
    const mapping: LocalPreviewMapping = {
      projectId: input.projectId,
      runId: payload.runId,
      projectToken: payload.projectToken,
      runnerUrl: this.runnerUrl,
      previewUrl: payload.previewUrl,
      status: payload.status === "ready" ? "ready" : "starting",
      startedAt: now,
      updatedAt: now,
      input: {
        repo: body.repo,
        repositoryUrl: merged.repositoryUrl,
        localPath: body.localPath,
        branchOrCommit: body.branchOrCommit,
        commitSha: body.commitSha,
        bootMode: body.bootMode,
        injectSupabasePlaceholders: body.injectSupabasePlaceholders,
      },
    };
    await this.writeMapping(mapping);
    await appendJsonLog(path.join(this.storageDir, "logs", "preview.log.jsonl"), {
      action: "start",
      projectId: input.projectId,
      runId: payload.runId,
      at: now,
    });

    return {
      projectId: input.projectId,
      runId: payload.runId,
      status: payload.status === "ready" ? "ready" : "starting",
      previewUrl: payload.previewUrl,
      reusedExistingRun: payload.reusedExistingRun === true,
    };
  }

  async getPreviewStatus(projectId: string): Promise<PreviewStatusResult> {
    const mapping = await this.readMapping(projectId);
    if (!mapping?.runId) {
      return { projectId, status: "idle" };
    }

    const headers: Record<string, string> = {};
    if (mapping.projectToken) {
      headers["x-visudev-project-token"] = mapping.projectToken;
    }

    let response: Response;
    try {
      response = await this.runnerFetch(`/status/${encodeURIComponent(mapping.runId)}`, {
        headers,
      });
    } catch {
      return {
        projectId,
        runId: mapping.runId,
        status: "failed",
        error: {
          code: "PREVIEW_RUNNER_UNAVAILABLE",
          message: `Preview Runner is not reachable at ${this.runnerUrl}`,
        },
      };
    }

    const text = await response.text();
    let payload: { status?: string; previewUrl?: string; error?: string };
    try {
      payload = text ? (JSON.parse(text) as typeof payload) : {};
    } catch {
      return { projectId, runId: mapping.runId, status: mapping.status };
    }

    const status = (payload.status as PreviewStatusResult["status"]) ?? mapping.status;
    const previewUrl = payload.previewUrl ?? mapping.previewUrl;
    mapping.status = status === "ready" ? "ready" : status;
    mapping.previewUrl = previewUrl;
    mapping.updatedAt = new Date().toISOString();
    await this.writeMapping(mapping);

    return {
      projectId,
      runId: mapping.runId,
      status,
      previewUrl,
      error: payload.error ? { code: "PREVIEW_STATUS_ERROR", message: payload.error } : undefined,
    };
  }

  async stopPreview(projectId: string): Promise<PreviewStopResult> {
    try {
      await this.runnerFetch(`/stop-project/${encodeURIComponent(projectId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
    } catch {
      return {
        projectId,
        status: "failed",
        error: {
          code: "PREVIEW_RUNNER_UNAVAILABLE",
          message: `Preview Runner is not reachable at ${this.runnerUrl}`,
        },
      };
    }

    const mapping = await this.readMapping(projectId);
    if (mapping) {
      mapping.status = "stopped";
      mapping.updatedAt = new Date().toISOString();
      await this.writeMapping(mapping);
    }

    return { projectId, status: "stopped" };
  }

  async crawlPreview(projectId: string, input: CrawlPreviewInput): Promise<CrawlPreviewResult> {
    const mapping = await this.readMapping(projectId);
    if (!mapping?.runId) {
      throw Object.assign(new Error("No active preview run for this project."), {
        statusCode: 409,
        code: "PREVIEW_NOT_STARTED",
      });
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (mapping.projectToken) {
      headers["x-visudev-project-token"] = mapping.projectToken;
    }

    const response = await this.runnerFetch(`/crawl/${encodeURIComponent(mapping.runId)}`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        screens: input.screens,
        maxScreens: input.maxScreens ?? 8,
        maxClicksPerScreen: input.maxClicksPerScreen ?? 4,
      }),
    });

    const text = await response.text();
    let payload: { success?: boolean; data?: Record<string, unknown>; error?: string };
    try {
      payload = text ? (JSON.parse(text) as typeof payload) : {};
    } catch {
      throw Object.assign(new Error("Preview Runner returned invalid JSON for crawl."), {
        statusCode: 502,
        code: "CRAWL_INVALID_JSON",
      });
    }

    if (!response.ok || !payload.success || !payload.data) {
      const message = payload.error || `Runner crawl failed (${response.status})`;
      const code =
        response.status === 409
          ? "PREVIEW_NOT_READY"
          : response.status === 404
            ? "PREVIEW_RUN_NOT_FOUND"
            : "CRAWL_FAILED";
      throw Object.assign(new Error(message), { statusCode: response.status || 500, code });
    }

    const now = new Date().toISOString();
    return {
      projectId,
      previewRunId: mapping.runId,
      runtime: payload.data,
      screens: input.screens,
      updatedAt: now,
    };
  }
}
