/**
 * Async analysis orchestration for Local Engine (blueprint + appflow + data).
 * Location: local-engine/src/services/analysis.service.ts
 */

import path from "node:path";
import { appendJsonLog, readJsonFile, writeJsonFile } from "../storage/file-store.js";
import { AutoGuideAnalysisProvider } from "../providers/autoguide-analysis.provider.js";
import { AutoGuideStubProvider } from "../providers/autoguide-stub.provider.js";
import type { AnalysisProvider } from "../providers/analysis-provider.js";
import type { BlueprintProvider } from "../providers/blueprint-provider.interface.js";
import { LegacyAppflowRunnerProvider } from "../providers/legacy-appflow-runner.provider.js";
import { LocalDataIntrospectionProvider } from "../providers/local-data-introspection.provider.js";
import { LegacyVisuDevAnalysisProvider } from "../providers/legacy-visudev-analysis.provider.js";
import type { EngineConfig } from "../config.js";
import { ALL_SCAN_SEQUENCE, aggregateParentStatus, isParentScanType } from "../lib/analysis-all.js";
import type { ProjectService } from "./project.service.js";
import { enrichBlueprint } from "./blueprint-enrichment.service.js";
import {
  readAnalysisOrigin,
  isAnalysisOrigin,
  type AnalysisOriginReader,
} from "./analysis-origin.service.js";
import { attachSnapshotsToGraph } from "./software-graph/_snapshots.js";
import type { AnalysisOrigin } from "../../../shared/software-graph.types.js";
import type {
  AnalysisChildRunStatus,
  AnalysisRunStatus,
  AnalyzeProjectRequest,
  BlueprintAnalysisProviderId,
  BlueprintDocument,
  EngineAnalysisRun,
  EngineParentAnalysisRun,
  LocalAllAnalysisResult,
  LocalAppflowAnalysisResult,
  LocalAppflowLatest,
  LocalBlueprintAnalysisResult,
  LocalBlueprintLatest,
  LocalDataAnalysisResult,
  LocalDataLatest,
  LocalEngineAnalysisResult,
  LocalVisuDevProject,
  RawBlueprintScan,
  StartAnalysisResponse,
  SupportedScanType,
} from "../types/api.types.js";

function createRunId(): string {
  return `run_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function providerIdForScanType(
  scanType: SupportedScanType,
  blueprintProviderId: BlueprintAnalysisProviderId,
): EngineAnalysisRun["providerId"] {
  if (scanType === "appflow") return "legacy-appflow-runner";
  if (scanType === "data") return "local-data-introspection";
  return blueprintProviderId;
}

function resolveBlueprintProviderId(
  config: EngineConfig,
  project?: LocalVisuDevProject,
): BlueprintAnalysisProviderId {
  if (project?.blueprintProviderId) return project.blueprintProviderId;
  if (config.analysisProvider === "autoguide") return "autoguide";
  return "legacy-blueprint-runner";
}

function isParentAnalysisRun(value: unknown): value is EngineParentAnalysisRun {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    candidate.scanType === "all" &&
    Array.isArray(candidate.childRuns) &&
    candidate.childRuns.every(
      (child) =>
        child &&
        typeof child === "object" &&
        typeof (child as { scanType?: unknown }).scanType === "string" &&
        typeof (child as { runId?: unknown }).runId === "string",
    )
  );
}

export class AnalysisService {
  private readonly analysisProviders: Map<string, AnalysisProvider>;
  private readonly blueprintProviders: Map<string, BlueprintProvider>;
  private readonly defaultBlueprintProviderId: BlueprintAnalysisProviderId;
  private readonly readAnalysisOrigin: AnalysisOriginReader;

  constructor(
    private readonly storageDir: string,
    private readonly projectService: ProjectService,
    runnerUrl: string,
    config: EngineConfig,
    deps?: { readAnalysisOrigin?: AnalysisOriginReader },
  ) {
    this.readAnalysisOrigin = deps?.readAnalysisOrigin ?? readAnalysisOrigin;
    this.defaultBlueprintProviderId = resolveBlueprintProviderId(config);

    const legacyBlueprintProvider = new LegacyVisuDevAnalysisProvider(runnerUrl);
    const autoguideProvider = new AutoGuideAnalysisProvider({
      autoguideRoot: config.autoguideRoot,
      sourceSubdir: config.autoguideSourceDir,
    });

    this.blueprintProviders = new Map<string, BlueprintProvider>([
      [legacyBlueprintProvider.id, legacyBlueprintProvider],
      [autoguideProvider.id, autoguideProvider],
    ]);

    this.analysisProviders = new Map<string, AnalysisProvider>([
      ["legacy-appflow-runner", new LegacyAppflowRunnerProvider(runnerUrl)],
      ["local-data-introspection", new LocalDataIntrospectionProvider()],
    ]);
    if (config.autoguideStub) {
      this.analysisProviders.set("autoguide-stub", new AutoGuideStubProvider());
    }
  }

  private runDir(runId: string): string {
    return path.join(this.storageDir, "runs", runId);
  }

  private statusPath(runId: string): string {
    return path.join(this.runDir(runId), "status.json");
  }

  private resultPath(runId: string): string {
    return path.join(this.runDir(runId), "result.json");
  }

  private latestPointerPath(projectId: string, scanType: SupportedScanType): string {
    const fileName =
      scanType === "appflow"
        ? "latest-appflow-run.json"
        : scanType === "data"
          ? "latest-data-run.json"
          : "latest-blueprint-run.json";
    return path.join(this.storageDir, "projects", projectId, fileName);
  }

  private blueprintCachePath(projectId: string): string {
    return path.join(this.storageDir, "projects", projectId, "blueprint.json");
  }

  private appflowCachePath(projectId: string): string {
    return path.join(this.storageDir, "projects", projectId, "appflow.json");
  }

  private dataCachePath(projectId: string): string {
    return path.join(this.storageDir, "projects", projectId, "erd.json");
  }

  private resolveProvider(providerId: string): AnalysisProvider {
    const provider = this.analysisProviders.get(providerId);
    if (!provider) {
      throw new Error(`Unknown analysis provider: ${providerId}`);
    }
    return provider;
  }

  private resolveBlueprintProvider(providerId: BlueprintAnalysisProviderId): BlueprintProvider {
    const provider = this.blueprintProviders.get(providerId);
    if (!provider) {
      throw new Error(`Unknown blueprint provider: ${providerId}`);
    }
    return provider;
  }

  private resolveProjectBlueprintProviderId(
    project?: LocalVisuDevProject,
  ): BlueprintAnalysisProviderId {
    return project?.blueprintProviderId ?? this.defaultBlueprintProviderId;
  }

  private assertLeafScanType(scanType: AnalyzeProjectRequest["scanType"]): SupportedScanType {
    if (scanType === "blueprint" || scanType === "appflow" || scanType === "data") {
      return scanType;
    }
    const error = {
      code: "NOT_IMPLEMENTED_LOCAL_SCAN_TYPE",
      message: `Scan type "${scanType}" is not available in local mode yet.`,
    };
    throw Object.assign(new Error(error.message), { code: error.code, statusCode: 501 });
  }

  private async readRunStatus(runId: string): Promise<EngineAnalysisRun | null> {
    return readJsonFile<EngineAnalysisRun | null>(this.statusPath(runId), null);
  }

  private async readParentRun(runId: string): Promise<EngineParentAnalysisRun | null> {
    const raw = await readJsonFile<unknown | null>(this.statusPath(runId), null);
    if (!raw) return null;
    if (!isParentAnalysisRun(raw)) {
      return null;
    }
    return raw;
  }

  private async syncParentChildStatuses(
    parent: EngineParentAnalysisRun,
  ): Promise<EngineParentAnalysisRun> {
    const childRuns: AnalysisChildRunStatus[] = [];
    for (const child of parent.childRuns) {
      const childStatus = await this.readRunStatus(child.runId);
      childRuns.push({
        scanType: child.scanType,
        runId: child.runId,
        status: childStatus?.status ?? child.status,
        error: childStatus?.error,
      });
    }
    const status = aggregateParentStatus(childRuns.map((entry) => entry.status));
    return {
      ...parent,
      childRuns,
      status,
      updatedAt: new Date().toISOString(),
    };
  }

  async startAnalysis(
    projectId: string,
    request: AnalyzeProjectRequest,
    baseUrl: string,
  ): Promise<StartAnalysisResponse> {
    if (request.scanType === "all") {
      return this.startAllAnalyses(projectId, request, baseUrl);
    }

    const scanType = this.assertLeafScanType(request.scanType);
    const project = await this.projectService.getProject(projectId);
    if (!project) {
      throw Object.assign(new Error("Project not found"), { statusCode: 404 });
    }

    const blueprintProviderId = this.resolveProjectBlueprintProviderId(project);
    const providerId = providerIdForScanType(scanType, blueprintProviderId);

    const runId = createRunId();
    const now = new Date().toISOString();
    const status: EngineAnalysisRun = {
      runId,
      projectId,
      scanType,
      providerId,
      status: "queued",
      createdAt: now,
      updatedAt: now,
    };

    await writeJsonFile(this.statusPath(runId), status);
    await appendJsonLog(path.join(this.runDir(runId), "log.jsonl"), {
      at: now,
      message: "Analysis queued",
      scanType,
    });

    void this.executeRun(runId, projectId, request, providerId, scanType, project).catch(
      (error) => {
        console.error("[analysis] background run failed:", error);
      },
    );

    return {
      projectId,
      runId,
      scanType,
      status: "queued",
      statusUrl: `${baseUrl}/api/projects/${projectId}/analyze/${runId}`,
      resultUrl: `${baseUrl}/api/projects/${projectId}/analyze/${runId}/result`,
    };
  }

  private async startAllAnalyses(
    projectId: string,
    request: AnalyzeProjectRequest,
    baseUrl: string,
  ): Promise<StartAnalysisResponse> {
    const project = await this.projectService.getProject(projectId);
    if (!project) {
      throw Object.assign(new Error("Project not found"), { statusCode: 404 });
    }

    const parentRunId = createRunId();
    const now = new Date().toISOString();
    const childRuns: AnalysisChildRunStatus[] = ALL_SCAN_SEQUENCE.map((scanType) => ({
      scanType,
      runId: createRunId(),
      status: "queued",
    }));

    const parentStatus: EngineParentAnalysisRun = {
      runId: parentRunId,
      projectId,
      scanType: "all",
      status: "queued",
      childRuns,
      createdAt: now,
      updatedAt: now,
    };

    await writeJsonFile(this.statusPath(parentRunId), parentStatus);
    await appendJsonLog(path.join(this.runDir(parentRunId), "log.jsonl"), {
      at: now,
      message: "All-scan orchestration queued",
      scanType: "all",
    });

    void this.executeAllRuns(parentRunId, projectId, request, childRuns, project).catch((error) => {
      console.error("[analysis] all-scan background run failed:", error);
    });

    return {
      projectId,
      runId: parentRunId,
      scanType: "all",
      status: "queued",
      childRuns,
      statusUrl: `${baseUrl}/api/projects/${projectId}/analyze/${parentRunId}`,
      resultUrl: `${baseUrl}/api/projects/${projectId}/analyze/${parentRunId}/result`,
    };
  }

  private async executeAllRuns(
    parentRunId: string,
    projectId: string,
    request: AnalyzeProjectRequest,
    childRuns: AnalysisChildRunStatus[],
    project: LocalVisuDevProject,
  ): Promise<void> {
    const blueprintProviderId = this.resolveProjectBlueprintProviderId(project);
    const startedAt = new Date().toISOString();
    await writeJsonFile(this.statusPath(parentRunId), {
      runId: parentRunId,
      projectId,
      scanType: "all",
      status: "running",
      childRuns,
      createdAt: startedAt,
      updatedAt: startedAt,
    } satisfies EngineParentAnalysisRun);

    const children: LocalAllAnalysisResult["children"] = {};
    const childStatusByType: Record<SupportedScanType, AnalysisChildRunStatus["status"]> = {
      blueprint: "queued",
      appflow: "queued",
      data: "queued",
    };
    let errorCount = 0;

    for (const child of childRuns) {
      const providerId = providerIdForScanType(child.scanType, blueprintProviderId);
      const runningChildRuns = childRuns.map((entry) =>
        entry.scanType === child.scanType ? { ...entry, status: "running" as const } : entry,
      );
      await writeJsonFile(this.statusPath(parentRunId), {
        runId: parentRunId,
        projectId,
        scanType: "all",
        status: "running",
        childRuns: runningChildRuns,
        createdAt: startedAt,
        updatedAt: new Date().toISOString(),
      } satisfies EngineParentAnalysisRun);

      const leafRequest: AnalyzeProjectRequest = {
        ...request,
        scanType: child.scanType,
      };

      await this.executeRun(
        child.runId,
        projectId,
        leafRequest,
        providerId,
        child.scanType,
        project,
      );

      const childStatus = await this.readRunStatus(child.runId);
      const finalStatus = childStatus?.status ?? "failed";
      childStatusByType[child.scanType] = finalStatus;
      if (finalStatus === "failed") {
        errorCount += 1;
      } else {
        const result = await readJsonFile<LocalEngineAnalysisResult | null>(
          this.resultPath(child.runId),
          null,
        );
        if (result?.kind === "blueprint") {
          children.blueprint = result;
        } else if (result?.kind === "appflow") {
          children.appflow = result;
        } else if (result?.kind === "data") {
          children.data = result;
        }
      }

      const updatedChildRuns = childRuns.map((entry) =>
        entry.scanType === child.scanType
          ? {
              ...entry,
              status: finalStatus,
              error: childStatus?.error,
            }
          : entry,
      );
      childRuns.splice(0, childRuns.length, ...updatedChildRuns);

      await writeJsonFile(this.statusPath(parentRunId), {
        runId: parentRunId,
        projectId,
        scanType: "all",
        status: aggregateParentStatus(updatedChildRuns.map((entry) => entry.status)),
        childRuns: updatedChildRuns,
        createdAt: startedAt,
        updatedAt: new Date().toISOString(),
      } satisfies EngineParentAnalysisRun);
    }

    const finishedAt = new Date().toISOString();
    const parentStatus = aggregateParentStatus(childRuns.map((entry) => entry.status));
    const allResult: LocalAllAnalysisResult = {
      kind: "all",
      projectId,
      runId: parentRunId,
      status:
        parentStatus === "success" ? "success" : parentStatus === "failed" ? "failed" : "partial",
      createdAt: finishedAt,
      summary: {
        blueprint: childStatusByType.blueprint,
        appflow: childStatusByType.appflow,
        data: childStatusByType.data,
        warnings: 0,
        errors: errorCount,
      },
      children,
    };

    await writeJsonFile(this.resultPath(parentRunId), allResult);
    await writeJsonFile(this.statusPath(parentRunId), {
      runId: parentRunId,
      projectId,
      scanType: "all",
      status: parentStatus,
      childRuns,
      createdAt: startedAt,
      updatedAt: finishedAt,
      error:
        parentStatus === "failed"
          ? {
              code: "ALL_SCANS_FAILED",
              message: "Blueprint, App Flow, and Data scans all failed.",
            }
          : undefined,
    } satisfies EngineParentAnalysisRun);
  }

  private async executeRun(
    runId: string,
    projectId: string,
    request: AnalyzeProjectRequest,
    providerId: EngineAnalysisRun["providerId"],
    scanType: SupportedScanType,
    project: LocalVisuDevProject,
  ): Promise<void> {
    const runningAt = new Date().toISOString();
    await writeJsonFile(this.statusPath(runId), {
      runId,
      projectId,
      scanType,
      providerId,
      status: "running",
      createdAt: runningAt,
      updatedAt: runningAt,
    } satisfies EngineAnalysisRun);

    let result: LocalEngineAnalysisResult;
    let blueprintOrigin: AnalysisOrigin | undefined;
    try {
      if (scanType === "blueprint") {
        const blueprintProviderId = this.resolveProjectBlueprintProviderId(project);
        const provider = this.resolveBlueprintProvider(blueprintProviderId);
        const rawScan = await provider.scanProject({
          ...request,
          projectId,
          project,
          localPath: request.localPath ?? project.localPath,
        });
        blueprintOrigin = isAnalysisOrigin(rawScan.analysisOrigin)
          ? rawScan.analysisOrigin
          : await this.readAnalysisOrigin(rawScan.localPath);
        result = this.buildBlueprintResult(
          runId,
          projectId,
          blueprintProviderId,
          rawScan,
          blueprintOrigin,
        );
      } else {
        const provider = this.resolveProvider(providerId);
        result = await provider.analyzeProject({
          ...request,
          projectId,
          project,
          localPath: request.localPath ?? project.localPath,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Analysis failed.";
      const code =
        error && typeof error === "object" && "code" in error
          ? String((error as { code?: unknown }).code ?? "ANALYSIS_FAILED")
          : "ANALYSIS_FAILED";
      result = {
        kind: "failed",
        projectId,
        runId,
        status: "failed",
        error: { code, message },
      };
    }

    const finishedAt = new Date().toISOString();

    if (scanType === "blueprint") {
      await this.persistBlueprintRun(
        runId,
        projectId,
        providerId,
        runningAt,
        finishedAt,
        result,
        blueprintOrigin,
      );
      return;
    }

    if (scanType === "appflow") {
      await this.persistAppflowRun(runId, projectId, providerId, runningAt, finishedAt, result);
      return;
    }

    await this.persistDataRun(runId, projectId, providerId, runningAt, finishedAt, result);
  }

  private buildBlueprintResult(
    runId: string,
    projectId: string,
    providerId: BlueprintAnalysisProviderId,
    rawScan: RawBlueprintScan,
    origin: AnalysisOrigin,
  ): LocalBlueprintAnalysisResult {
    const blueprint: BlueprintDocument = {
      ...enrichBlueprint(rawScan),
      branch: origin.branch,
      commitSha: origin.commitSha,
      analysisOrigin: origin,
    };
    const routesDetected = rawScan.routes.length;
    const findings = Array.isArray(blueprint.findings) ? blueprint.findings.length : 0;

    return {
      kind: "blueprint",
      projectId,
      runId,
      providerId,
      status: "success",
      createdAt: new Date().toISOString(),
      summary: {
        routesDetected,
        findings,
        filesAnalyzed: rawScan.filesAnalyzed,
        warnings: 0,
        errors: 0,
      },
      blueprint,
      raw: rawScan.providerMetadata,
    };
  }

  private async persistBlueprintRun(
    runId: string,
    projectId: string,
    providerId: EngineAnalysisRun["providerId"],
    runningAt: string,
    finishedAt: string,
    result: LocalEngineAnalysisResult,
    origin: AnalysisOrigin | undefined,
  ): Promise<void> {
    if (result.kind !== "blueprint") {
      await writeJsonFile(this.statusPath(runId), {
        runId,
        projectId,
        scanType: "blueprint",
        providerId,
        status: "failed",
        createdAt: runningAt,
        updatedAt: finishedAt,
        error:
          result.kind === "failed"
            ? result.error
            : result.kind === "unsupported"
              ? {
                  code: "ANALYSIS_UNSUPPORTED",
                  message: result.message,
                }
              : {
                  code: "ANALYSIS_UNSUPPORTED",
                  message: "Unexpected analysis result.",
                },
      } satisfies EngineAnalysisRun);
      return;
    }

    const blueprintResult: LocalBlueprintAnalysisResult = {
      ...result,
      runId,
      createdAt: finishedAt,
    };
    const analysisOrigin = origin ?? {
      sourceKind: "filesystem",
      dirty: false,
      capturedAt: finishedAt,
    };

    const previousLatest = await readJsonFile<LocalBlueprintLatest | null>(
      this.blueprintCachePath(projectId),
      null,
    );
    if (blueprintResult.blueprint.graph) {
      const rawCommitSha = blueprintResult.blueprint.commitSha;
      const commitSha = typeof rawCommitSha === "string" ? rawCommitSha : undefined;
      blueprintResult.blueprint = {
        ...blueprintResult.blueprint,
        graph: attachSnapshotsToGraph(
          blueprintResult.blueprint.graph,
          {
            ref: commitSha ?? analysisOrigin.capturedAt,
            capturedAt: analysisOrigin.capturedAt,
            commitSha,
            branch: analysisOrigin.branch,
            sourceKind: analysisOrigin.sourceKind,
            dirty: analysisOrigin.dirty,
          },
          previousLatest?.blueprint?.graph?.snapshots,
        ),
      };
    }

    const runnerAnalysisId =
      result.raw && typeof result.raw === "object" && "legacy" in result.raw
        ? String(
            (result.raw as { legacy?: { runnerAnalysisId?: string } }).legacy?.runnerAnalysisId ??
              "",
          )
        : undefined;

    await writeJsonFile(this.resultPath(runId), blueprintResult);
    await writeJsonFile(this.statusPath(runId), {
      runId,
      projectId,
      scanType: "blueprint",
      providerId,
      runnerAnalysisId,
      status: "success",
      createdAt: runningAt,
      updatedAt: finishedAt,
    } satisfies EngineAnalysisRun);

    await writeJsonFile(this.latestPointerPath(projectId, "blueprint"), {
      projectId,
      runId,
      updatedAt: finishedAt,
    });
    await writeJsonFile(this.blueprintCachePath(projectId), {
      projectId,
      runId,
      blueprint: blueprintResult.blueprint,
      updatedAt: finishedAt,
    } satisfies LocalBlueprintLatest);
    await appendJsonLog(path.join(this.runDir(runId), "log.jsonl"), {
      at: finishedAt,
      message:
        analysisOrigin.sourceKind === "git" && analysisOrigin.commitSha
          ? `Analyzed commit ${analysisOrigin.commitSha}`
          : `Analyzed local folder at ${analysisOrigin.capturedAt} (no git repository)`,
      scanType: "blueprint",
    });

    const current = await this.projectService.getProject(projectId);
    if (current) {
      current.analysis = {
        ...current.analysis,
        latestBlueprintRunId: runId,
        latestBlueprintStatus: "success",
        updatedAt: finishedAt,
      };
      await this.projectService.saveProject(current);
    }
  }

  private async persistAppflowRun(
    runId: string,
    projectId: string,
    providerId: EngineAnalysisRun["providerId"],
    runningAt: string,
    finishedAt: string,
    result: LocalEngineAnalysisResult,
  ): Promise<void> {
    if (result.kind !== "appflow") {
      await writeJsonFile(this.statusPath(runId), {
        runId,
        projectId,
        scanType: "appflow",
        providerId,
        status: "failed",
        createdAt: runningAt,
        updatedAt: finishedAt,
        error:
          result.kind === "failed"
            ? result.error
            : result.kind === "unsupported"
              ? {
                  code: "ANALYSIS_UNSUPPORTED",
                  message: result.message,
                }
              : {
                  code: "ANALYSIS_UNSUPPORTED",
                  message: "Unexpected analysis result.",
                },
      } satisfies EngineAnalysisRun);
      return;
    }

    const appflowResult: LocalAppflowAnalysisResult = {
      ...result,
      runId,
      createdAt: finishedAt,
    };

    const runnerAnalysisId =
      result.raw && typeof result.raw === "object" && "runnerAnalysisId" in result.raw
        ? String((result.raw as { runnerAnalysisId?: string }).runnerAnalysisId ?? "")
        : undefined;

    await writeJsonFile(this.resultPath(runId), appflowResult);
    await writeJsonFile(this.statusPath(runId), {
      runId,
      projectId,
      scanType: "appflow",
      providerId,
      runnerAnalysisId,
      status: "success",
      createdAt: runningAt,
      updatedAt: finishedAt,
    } satisfies EngineAnalysisRun);

    await writeJsonFile(this.latestPointerPath(projectId, "appflow"), {
      projectId,
      runId,
      updatedAt: finishedAt,
    });
    await writeJsonFile(this.appflowCachePath(projectId), {
      projectId,
      runId,
      screens: appflowResult.screens,
      flows: appflowResult.flows,
      graph: appflowResult.graph,
      quality: appflowResult.quality,
      framework: appflowResult.framework,
      commitSha: appflowResult.commitSha,
      updatedAt: finishedAt,
    } satisfies LocalAppflowLatest);

    const current = await this.projectService.getProject(projectId);
    if (current) {
      current.analysis = {
        ...current.analysis,
        latestAppflowRunId: runId,
        latestAppflowStatus: "success",
        updatedAt: finishedAt,
      };
      await this.projectService.saveProject(current);
    }
  }

  private async persistDataRun(
    runId: string,
    projectId: string,
    providerId: EngineAnalysisRun["providerId"],
    runningAt: string,
    finishedAt: string,
    result: LocalEngineAnalysisResult,
  ): Promise<void> {
    if (result.kind !== "data") {
      await writeJsonFile(this.statusPath(runId), {
        runId,
        projectId,
        scanType: "data",
        providerId,
        status: "failed",
        createdAt: runningAt,
        updatedAt: finishedAt,
        error:
          result.kind === "failed"
            ? result.error
            : result.kind === "unsupported"
              ? {
                  code: "ANALYSIS_UNSUPPORTED",
                  message: result.message,
                }
              : {
                  code: "ANALYSIS_UNSUPPORTED",
                  message: "Unexpected analysis result.",
                },
      } satisfies EngineAnalysisRun);
      return;
    }

    const dataResult: LocalDataAnalysisResult = {
      ...result,
      runId,
      createdAt: finishedAt,
    };

    await writeJsonFile(this.resultPath(runId), dataResult);
    await writeJsonFile(this.statusPath(runId), {
      runId,
      projectId,
      scanType: "data",
      providerId,
      status: "success",
      createdAt: runningAt,
      updatedAt: finishedAt,
    } satisfies EngineAnalysisRun);

    await writeJsonFile(this.latestPointerPath(projectId, "data"), {
      projectId,
      runId,
      updatedAt: finishedAt,
    });
    await writeJsonFile(this.dataCachePath(projectId), {
      projectId,
      runId,
      nodes: dataResult.erd.nodes,
      tables: dataResult.erd.tables,
      message: dataResult.erd.message,
      dialect: dataResult.erd.dialect,
      source: dataResult.erd.source,
      updatedAt: finishedAt,
    } satisfies LocalDataLatest);

    const current = await this.projectService.getProject(projectId);
    if (current) {
      current.analysis = {
        ...current.analysis,
        latestDataRunId: runId,
        latestDataStatus: "success",
        updatedAt: finishedAt,
      };
      await this.projectService.saveProject(current);
    }
  }

  async getStatus(projectId: string, runId: string): Promise<AnalysisRunStatus> {
    const parent = await this.readParentRun(runId);
    if (parent && parent.projectId === projectId) {
      const synced = await this.syncParentChildStatuses(parent);
      if (synced.status !== parent.status) {
        await writeJsonFile(this.statusPath(runId), synced);
      }
      const isTerminal =
        synced.status === "success" || synced.status === "partial" || synced.status === "failed";
      return {
        projectId: synced.projectId,
        runId: synced.runId,
        scanType: synced.scanType,
        status: synced.status,
        startedAt: synced.createdAt,
        finishedAt: isTerminal ? synced.updatedAt : undefined,
        error: synced.error,
        children: synced.childRuns,
      };
    }

    const status = await this.readRunStatus(runId);
    if (!status || status.projectId !== projectId) {
      throw Object.assign(new Error("Analysis run not found"), { statusCode: 404 });
    }
    const isTerminal =
      status.status === "success" || status.status === "partial" || status.status === "failed";
    return {
      projectId: status.projectId,
      runId: status.runId,
      scanType: status.scanType,
      status: status.status,
      startedAt: status.createdAt,
      finishedAt: isTerminal ? status.updatedAt : undefined,
      error: status.error,
    };
  }

  async getResult(projectId: string, runId: string): Promise<LocalEngineAnalysisResult> {
    const status = await this.getStatus(projectId, runId);
    if (status.status === "queued" || status.status === "running") {
      return {
        kind: "failed",
        projectId,
        runId,
        status: "failed",
        error: {
          code: "ANALYSIS_NOT_READY",
          message: "Analysis is still running.",
        },
      };
    }
    if (status.status === "failed") {
      return {
        kind: "failed",
        projectId,
        runId,
        status: "failed",
        error: status.error ?? {
          code: "ANALYSIS_FAILED",
          message: "Analysis failed.",
        },
      };
    }

    if (isParentScanType(status.scanType)) {
      const result = await readJsonFile<LocalAllAnalysisResult | null>(
        this.resultPath(runId),
        null,
      );
      if (!result) {
        return {
          kind: "failed",
          projectId,
          runId,
          status: "failed",
          error: {
            code: "ANALYSIS_RESULT_MISSING",
            message: "Analysis result file is missing.",
          },
        };
      }
      return result;
    }

    if (status.scanType === "appflow") {
      const result = await readJsonFile<LocalAppflowAnalysisResult | null>(
        this.resultPath(runId),
        null,
      );
      if (!result) {
        return {
          kind: "failed",
          projectId,
          runId,
          status: "failed",
          error: {
            code: "ANALYSIS_RESULT_MISSING",
            message: "Analysis result file is missing.",
          },
        };
      }
      return result;
    }

    if (status.scanType === "data") {
      const result = await readJsonFile<LocalDataAnalysisResult | null>(
        this.resultPath(runId),
        null,
      );
      if (!result) {
        return {
          kind: "failed",
          projectId,
          runId,
          status: "failed",
          error: {
            code: "ANALYSIS_RESULT_MISSING",
            message: "Analysis result file is missing.",
          },
        };
      }
      return result;
    }

    const result = await readJsonFile<LocalBlueprintAnalysisResult | null>(
      this.resultPath(runId),
      null,
    );
    if (!result) {
      return {
        kind: "failed",
        projectId,
        runId,
        status: "failed",
        error: {
          code: "ANALYSIS_RESULT_MISSING",
          message: "Analysis result file is missing.",
        },
      };
    }
    return result;
  }

  async getBlueprintLatest(projectId: string): Promise<LocalBlueprintLatest | null> {
    return readJsonFile<LocalBlueprintLatest | null>(this.blueprintCachePath(projectId), null);
  }

  async getAppflowLatest(projectId: string): Promise<LocalAppflowLatest | null> {
    return readJsonFile<LocalAppflowLatest | null>(this.appflowCachePath(projectId), null);
  }

  async getDataLatest(projectId: string): Promise<LocalDataLatest | null> {
    return readJsonFile<LocalDataLatest | null>(this.dataCachePath(projectId), null);
  }
}
