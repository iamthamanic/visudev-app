/**
 * Legacy App Flow analysis via Preview Runner /appflow/analyze.
 * Location: local-engine/src/providers/legacy-appflow-runner.provider.ts
 */

import type { AnalysisProvider, AnalyzeProjectInput } from "./analysis-provider.js";
import type { LocalEngineAnalysisResult } from "../types/api.types.js";

type RunnerAppflowResponse = {
  success?: boolean;
  data?: {
    screens?: unknown[];
    flows?: unknown[];
    graph?: unknown;
    quality?: unknown;
    framework?: unknown;
    analysisId?: string;
    commitSha?: string;
    filesAnalyzed?: number;
    workspaceRoot?: string;
  };
  error?: string;
};

export class LegacyAppflowRunnerProvider implements AnalysisProvider {
  readonly id = "legacy-appflow-runner";
  readonly name = "Legacy Appflow Runner";

  constructor(
    private readonly runnerUrl: string,
    private readonly runnerSecret = "",
  ) {}

  async analyzeProject(input: AnalyzeProjectInput): Promise<LocalEngineAnalysisResult> {
    const localPath = input.localPath ?? input.project.localPath;
    if (!localPath) {
      return {
        kind: "failed",
        projectId: input.projectId,
        runId: "",
        status: "failed",
        error: {
          code: "MISSING_LOCAL_PATH",
          message: "App Flow analysis requires a local project path.",
        },
      };
    }

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (this.runnerSecret) {
      headers["X-VisuDev-Runner-Secret"] = this.runnerSecret;
    }
    const response = await fetch(`${this.runnerUrl.replace(/\/$/, "")}/appflow/analyze`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        projectId: input.projectId,
        localPath,
      }),
    });

    const text = await response.text();
    let payload: RunnerAppflowResponse;
    try {
      payload = text ? (JSON.parse(text) as RunnerAppflowResponse) : {};
    } catch {
      return {
        kind: "failed",
        projectId: input.projectId,
        runId: "",
        status: "failed",
        error: {
          code: "RUNNER_INVALID_JSON",
          message: "Preview Runner returned invalid JSON for appflow analysis.",
        },
      };
    }

    if (!response.ok || !payload.success || !Array.isArray(payload.data?.screens)) {
      const message = payload.error || `Runner error ${response.status}`;
      const code =
        response.status === 503
          ? "DENO_NOT_AVAILABLE"
          : response.status === 403
            ? "LOCAL_PATH_FORBIDDEN"
            : "APPFLOW_ANALYSIS_FAILED";
      return {
        kind: "failed",
        projectId: input.projectId,
        runId: "",
        status: "failed",
        error: { code, message },
      };
    }

    const screens = payload.data.screens;
    const flows = Array.isArray(payload.data.flows) ? payload.data.flows : [];

    return {
      kind: "appflow",
      projectId: input.projectId,
      runId: "",
      providerId: "legacy-appflow-runner",
      status: "success",
      createdAt: new Date().toISOString(),
      summary: {
        screensDetected: screens.length,
        flowsDetected: flows.length,
        filesAnalyzed: payload.data.filesAnalyzed,
        warnings: 0,
        errors: 0,
      },
      screens,
      flows,
      graph: payload.data.graph,
      quality: payload.data.quality,
      framework: payload.data.framework,
      commitSha: payload.data.commitSha,
      raw: {
        runnerAnalysisId: payload.data.analysisId,
        workspaceRoot: payload.data.workspaceRoot,
      },
    };
  }
}
