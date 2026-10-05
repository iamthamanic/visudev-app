/* eslint-disable react-refresh/only-export-components */
import React, {
  createContext,
  useContext,
  useState,
  useRef,
  ReactNode,
  useCallback,
  useEffect,
} from "react";
import type { AnalyzerResponse, AnalyzerScreenshotsResponse } from "./analyzer";
import { buildEscalationJobs } from "./escalation-jobs";
import { mergeRuntimeIntoAnalysis } from "./runtime-crawl";
import {
  AnalysisResult,
  Project,
  ScanResult,
  ScanStatuses,
  Screen,
  ScreenshotStatus,
  StepLogEntry,
} from "./types";
import type { PreviewMode, PreviewStatus } from "./types";
import { getProjectSourceMode } from "./project-source";
import {
  getVisuDevClient,
  isLocalVisuDevMode,
  setSupabaseAccessToken,
  VisuDevApiError,
} from "../visudev-api";
import type { CreateProjectInput } from "../visudev-api/types";
import { publicAnonKey, supabaseUrl } from "../../utils/supabase/info";
import type { PreviewStepLog } from "../../utils/api";
import { previewAPI } from "../../utils/api";
import { BlueprintScanError, runBlueprintScan } from "./blueprint-scan";
import { runLocalAppflowCrawlIfNeeded } from "./run-local-appflow-crawl";

export type { PreviewStepLog };

export interface PreviewState {
  projectId: string | null;
  runId: string | null;
  status: PreviewStatus;
  previewUrl: string | null;
  error: string | null;
  /** Schritte vom Preview-Runner (Start/Refresh): Git, Build, Start, Bereit. */
  refreshLogs: PreviewStepLog[];
  /** Zeitpunkt (ISO), zu dem die Preview zuletzt „ready“ wurde (für Anzeige „Letzter Preview-Start“). */
  previewReadyAt: string | null;
}

interface VisudevStore {
  // Projects
  projects: Project[];
  projectsLoading: boolean;
  setProjectsLoading: (loading: boolean) => void;
  activeProject: Project | null;
  setActiveProject: (project: Project | null) => void;
  addProject: (
    project: Omit<Project, "id" | "createdAt" | "screens" | "flows">,
  ) => Promise<Project>;
  updateProject: (project: Project) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  loadProjects: () => Promise<void>;

  // Scans
  scans: ScanResult[];
  scanStatuses: ScanStatuses;
  startScan: (scanType: "appflow" | "blueprint" | "data" | "all") => Promise<void>;
  refreshScanStatus: () => Promise<void>;

  // Preview (Live App)
  preview: PreviewState;
  startPreview: (
    projectId: string,
    repo?: string,
    branchOrCommit?: string,
    commitSha?: string,
  ) => Promise<void>;
  refreshPreviewStatus: (projectId: string) => Promise<PreviewStatus | undefined>;
  refreshPreview: (projectId: string) => Promise<void>;
  stopPreview: (projectId: string) => Promise<void>;
  /** Set preview to failed when stuck in "starting" (e.g. timeout). */
  markPreviewStuck: (projectId: string, error: string) => Promise<void>;
  /** Set access token for preview Edge API (central mode). Call with session?.access_token when user logs in. */
  setPreviewAccessToken: (token: string | null) => void;
}

const VisudevContext = createContext<VisudevStore | null>(null);

/** Projekt aus API-Response normalisieren (screens/flows immer Arrays). */
function normalizeProject(p: Record<string, unknown> & { id: string }): Project {
  return {
    ...p,
    id: p.id,
    screens: Array.isArray(p.screens) ? (p.screens as Project["screens"]) : [],
    flows: Array.isArray(p.flows) ? (p.flows as Project["flows"]) : [],
  } as Project;
}

function applyRuntimeScreenshots(
  screens: Screen[],
  captures: Project["analysisRuntime"],
): Screen[] {
  const captureByScreenId = new Map(
    (captures?.stateScreens ?? [])
      .filter((capture) => capture.screenId && capture.screenshotUrl)
      .map((capture) => [capture.screenId as string, capture.screenshotUrl as string]),
  );
  if (captureByScreenId.size === 0) {
    return screens;
  }
  return screens.map((screen) => {
    const screenshotUrl = captureByScreenId.get(screen.id);
    if (!screenshotUrl) {
      return screen;
    }
    return {
      ...screen,
      screenshotUrl,
      screenshotStatus: "ok",
    };
  });
}

export function VisudevProvider({ children }: { children: ReactNode }) {
  const makePreviewLog = useCallback((message: string): PreviewStepLog => {
    return { time: new Date().toISOString(), message };
  }, []);
  const previewAccessTokenRef = useRef<string | null>(null);
  const setPreviewAccessToken = useCallback((token: string | null) => {
    previewAccessTokenRef.current = token;
    setSupabaseAccessToken(token);
  }, []);

  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [activeProject, setActiveProjectState] = useState<Project | null>(null);
  const [scans, setScans] = useState<ScanResult[]>([]);
  const [scanStatuses, setScanStatuses] = useState<ScanStatuses>({
    appflow: { status: "idle", progress: 0 },
    blueprint: { status: "idle", progress: 0 },
    data: { status: "idle", progress: 0 },
  });
  const [preview, setPreview] = useState<PreviewState>({
    projectId: null,
    runId: null,
    status: "idle",
    previewUrl: null,
    error: null,
    refreshLogs: [],
    previewReadyAt: null,
  });

  const getProjectPreviewMode = useCallback(
    (projectId: string): PreviewMode =>
      projects.find((project) => project.id === projectId)?.preview_mode ?? "auto",
    [projects],
  );

  const setActiveProject = useCallback((project: Project | null) => {
    setActiveProjectState(project);
  }, []);

  const loadProjects = useCallback(async () => {
    setProjectsLoading(true);
    try {
      const client = getVisuDevClient();
      const data = await client.listProjects();
      setProjects(
        data.map((p) => normalizeProject(p as unknown as Record<string, unknown> & { id: string })),
      );
    } catch (error) {
      console.error("[VisuDEV] loadProjects failed:", error);
      setProjects([]);
    } finally {
      setProjectsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  const addProject = useCallback(
    async (
      projectData: Omit<Project, "id" | "createdAt" | "screens" | "flows">,
    ): Promise<Project> => {
      const client = getVisuDevClient();
      if (isLocalVisuDevMode()) {
        const newProject = await client.createProject({
          name: projectData.name,
          localPath: projectData.local_path,
          repositoryUrl: projectData.github_repo,
          blueprintProviderId: projectData.blueprint_provider_id,
        });
        const normalized = normalizeProject(
          newProject as unknown as Record<string, unknown> & { id: string },
        );
        setProjects((prev) => [...prev, normalized]);
        return normalized;
      }

      const created = await client.createProject(projectData as unknown as CreateProjectInput);
      const normalized = normalizeProject(
        created as unknown as Record<string, unknown> & { id: string },
      );
      setProjects((prev) => [...prev, normalized]);
      return normalized;
    },
    [],
  );

  // Auto-activate first project when list has items
  useEffect(() => {
    if (projects.length > 0 && !activeProject) {
      setActiveProject(projects[0]);
    }
  }, [projects, activeProject, setActiveProject]);

  const updateProject = useCallback(async (project: Project) => {
    const client = getVisuDevClient();
    if (isLocalVisuDevMode()) {
      const updated = await client.updateProject(project.id, {
        name: project.name,
        localPath: project.local_path ?? null,
        repositoryUrl: project.github_repo ?? null,
        blueprintProviderId: project.blueprint_provider_id ?? null,
      });
      const normalized = normalizeProject(
        updated as unknown as Record<string, unknown> & { id: string },
      );
      setProjects((prev) => prev.map((p) => (p.id === normalized.id ? normalized : p)));
      setActiveProjectState((current) => (current?.id === normalized.id ? normalized : current));
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- omit from payload
    const { id, createdAt, updatedAt, ...payload } = project;
    const updated = await client.updateProject(id, payload);
    const normalized = normalizeProject(
      updated as unknown as Record<string, unknown> & { id: string },
    );
    setProjects((prev) => prev.map((p) => (p.id === normalized.id ? normalized : p)));
    setActiveProjectState((current) => (current?.id === normalized.id ? normalized : current));
  }, []);

  const deleteProject = useCallback(async (id: string) => {
    const client = getVisuDevClient();
    await client.deleteProject(id);
    setProjects((prev) => prev.filter((p) => p.id !== id));
    setActiveProjectState((current) => (current?.id === id ? null : current));
    setScans((prev) => prev.filter((s) => s.projectId !== id));
  }, []);

  const refreshScanStatus = useCallback(async () => {
    // In local-only mode, scan status is already in state
    // This function is a no-op for compatibility
  }, []);

  const startScan = useCallback(
    async (scanType: "appflow" | "blueprint" | "data" | "all") => {
      if (!activeProject) {
        console.warn("⚠️ [VisuDEV] No active project to scan");
        return;
      }

      // Local Gesamt-Scan: sequential App Flow → crawl → Blueprint → Data
      // (engine scanType=all previously merged stale runtime-crawl into Blueprint).

      const scanTypes =
        scanType === "all" ? (["appflow", "blueprint", "data"] as const) : [scanType];

      for (const type of scanTypes) {
        if (isLocalVisuDevMode() && type !== "blueprint" && type !== "appflow" && type !== "data") {
          const blockedMessage =
            "This scan type is not available in Local Mode yet. Use dev:supabase for legacy scans.";
          setScanStatuses((prev) => ({
            ...prev,
            [type]: {
              status: "failed",
              progress: 0,
              message: blockedMessage,
              error: blockedMessage,
            },
          }));
          continue;
        }

        const scanId = crypto.randomUUID();
        const timestamp = new Date().toISOString();
        const repoLabel = activeProject.github_repo ?? "unknown";
        const branchLabel = activeProject.github_branch ?? "main";
        const makeScanLog = (
          message: string,
          logType: StepLogEntry["type"] = "info",
        ): StepLogEntry => ({
          time: new Date().toISOString(),
          message,
          type: logType,
        });
        const appendScanLog = (message: string, logType: StepLogEntry["type"] = "info") => {
          setScans((prev) =>
            prev.map((scan) =>
              scan.id === scanId
                ? {
                    ...scan,
                    logs: [...(scan.logs ?? []), makeScanLog(message, logType)],
                  }
                : scan,
            ),
          );
        };

        // Set status to running
        setScanStatuses((prev) => ({
          ...prev,
          [type]: { status: "running", progress: 10, message: "Analyse gestartet" },
        }));

        // Create scan record
        const newScan: ScanResult = {
          id: scanId,
          projectId: activeProject.id,
          scanType: type,
          status: "running",
          progress: 10,
          startedAt: timestamp,
          logs: [
            makeScanLog(
              `Analyse gestartet (${type}) – Repo: ${repoLabel} @ ${branchLabel}`,
              "info",
            ),
          ],
        };

        setScans((prev) => [...prev, newScan]);
        appendScanLog("Analyzer-Request wird gesendet …", "info");

        try {
          if (type === "blueprint") {
            appendScanLog("Blueprint-Analyzer wird aufgerufen …", "info");
            setScanStatuses((prev) => ({
              ...prev,
              [type]: { status: "running", progress: 60, message: "Blueprint wird ausgewertet" },
            }));

            try {
              const client = getVisuDevClient();
              if (isLocalVisuDevMode()) {
                const started = await client.startAnalysis(activeProject.id, {
                  scanType: "blueprint",
                  localPath: activeProject.local_path,
                });
                const deadline = Date.now() + 150_000;
                let terminal = false;
                while (Date.now() < deadline) {
                  const status = await client.getAnalysisStatus(activeProject.id, started.runId);
                  if (status.status === "success" || status.status === "partial") {
                    const result = await client.getAnalysisResult(activeProject.id, started.runId);
                    if (result.kind === "blueprint") {
                      appendScanLog(
                        `Blueprint: ${result.summary.routesDetected} Routes, ${result.summary.findings} Findings.`,
                        "success",
                      );
                      appendScanLog("Blueprint lokal gespeichert.", "success");
                    }
                    terminal = true;
                    break;
                  }
                  if (status.status === "failed") {
                    throw new VisuDevApiError(
                      status.error?.message ?? "Blueprint analysis failed",
                      status.error?.code ?? "BLUEPRINT_ANALYSIS_FAILED",
                      "local",
                    );
                  }
                  await new Promise((resolve) => setTimeout(resolve, 1500));
                }
                if (!terminal) {
                  throw new Error("Blueprint analysis timed out.");
                }
              } else {
                const scanResult = await runBlueprintScan(
                  activeProject,
                  previewAccessTokenRef.current,
                );
                appendScanLog(
                  `Blueprint: ${scanResult.routeCount} Routes, ${scanResult.findingCount} Findings.`,
                  "success",
                );
                appendScanLog("Blueprint in KV gespeichert.", "success");
              }
            } catch (scanError) {
              const message =
                scanError instanceof BlueprintScanError
                  ? scanError.message
                  : scanError instanceof Error
                    ? scanError.message
                    : "Blueprint-Scan fehlgeschlagen";
              appendScanLog(message, "error");
              throw scanError;
            }

            setScans((prev) =>
              prev.map((scan) =>
                scan.id === scanId
                  ? {
                      ...scan,
                      status: "completed",
                      progress: 100,
                      completedAt: new Date().toISOString(),
                    }
                  : scan,
              ),
            );
            setScanStatuses((prev) => ({
              ...prev,
              [type]: { status: "completed", progress: 100, message: "Blueprint abgeschlossen" },
            }));
            continue;
          }

          if (type === "appflow" && isLocalVisuDevMode()) {
            appendScanLog("App-Flow-Analyzer wird lokal aufgerufen …", "info");
            setScanStatuses((prev) => ({
              ...prev,
              [type]: { status: "running", progress: 60, message: "App Flow wird ausgewertet" },
            }));

            const client = getVisuDevClient();
            const started = await client.startAnalysis(activeProject.id, {
              scanType: "appflow",
              localPath: activeProject.local_path,
            });
            const deadline = Date.now() + 150_000;
            let terminal = false;
            while (Date.now() < deadline) {
              const status = await client.getAnalysisStatus(activeProject.id, started.runId);
              if (status.status === "success" || status.status === "partial") {
                const result = await client.getAnalysisResult(activeProject.id, started.runId);
                if (result.kind === "appflow") {
                  await runLocalAppflowCrawlIfNeeded(
                    activeProject,
                    result,
                    appendScanLog,
                    updateProject,
                    client,
                  );
                }
                terminal = true;
                break;
              }
              if (status.status === "failed") {
                throw new VisuDevApiError(
                  status.error?.message ?? "App Flow analysis failed",
                  status.error?.code ?? "APPFLOW_ANALYSIS_FAILED",
                  "local",
                );
              }
              await new Promise((resolve) => setTimeout(resolve, 1500));
            }
            if (!terminal) {
              throw new Error("App Flow analysis timed out.");
            }

            setScans((prev) =>
              prev.map((scan) =>
                scan.id === scanId
                  ? {
                      ...scan,
                      status: "completed",
                      progress: 100,
                      completedAt: new Date().toISOString(),
                    }
                  : scan,
              ),
            );
            setScanStatuses((prev) => ({
              ...prev,
              [type]: { status: "completed", progress: 100, message: "App Flow abgeschlossen" },
            }));
            continue;
          }

          if (type === "data" && isLocalVisuDevMode()) {
            appendScanLog("Data-Analyzer wird lokal aufgerufen …", "info");
            setScanStatuses((prev) => ({
              ...prev,
              [type]: { status: "running", progress: 60, message: "Schema wird ausgewertet" },
            }));

            const client = getVisuDevClient();
            const started = await client.startAnalysis(activeProject.id, {
              scanType: "data",
              localPath: activeProject.local_path,
            });
            const deadline = Date.now() + 60_000;
            let terminal = false;
            while (Date.now() < deadline) {
              const status = await client.getAnalysisStatus(activeProject.id, started.runId);
              if (status.status === "success" || status.status === "partial") {
                const result = await client.getAnalysisResult(activeProject.id, started.runId);
                if (result.kind === "data") {
                  appendScanLog(
                    `Data: ${result.summary.tablesDetected} Tabellen, ${result.summary.columnsDetected} Spalten.`,
                    "success",
                  );
                  if (result.erd.message) {
                    appendScanLog(result.erd.message, "info");
                  }
                }
                terminal = true;
                break;
              }
              if (status.status === "failed") {
                throw new VisuDevApiError(
                  status.error?.message ?? "Data analysis failed",
                  status.error?.code ?? "DATA_ANALYSIS_FAILED",
                  "local",
                );
              }
              await new Promise((resolve) => setTimeout(resolve, 1000));
            }
            if (!terminal) {
              throw new Error("Data analysis timed out.");
            }

            setScans((prev) =>
              prev.map((scan) =>
                scan.id === scanId
                  ? {
                      ...scan,
                      status: "completed",
                      progress: 100,
                      completedAt: new Date().toISOString(),
                    }
                  : scan,
              ),
            );
            setScanStatuses((prev) => ({
              ...prev,
              [type]: { status: "completed", progress: 100, message: "Data abgeschlossen" },
            }));
            continue;
          }

          // ONLY call visudev-analyzer Edge Function for code analysis
          const analyzeResponse = await fetch(
            `${supabaseUrl}/functions/v1/visudev-analyzer/analyze`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${publicAnonKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                repo: activeProject.github_repo ?? "",
                branch: activeProject.github_branch ?? "main",
              }),
            },
          );

          setScanStatuses((prev) => ({
            ...prev,
            [type]: { status: "running", progress: 50, message: "Analyzer-Antwort empfangen" },
          }));

          if (!analyzeResponse.ok) {
            const errorText = await analyzeResponse.text();
            console.error(`❌ [VisuDEV] Analyzer error response:`, errorText);
            appendScanLog(
              `Analyzer fehlgeschlagen (${analyzeResponse.status}): ${errorText || "keine Details"}`,
              "error",
            );
            throw new Error(`Analyzer returned ${analyzeResponse.status}: ${errorText}`);
          }

          const analysisData = (await analyzeResponse.json()) as AnalyzerResponse;
          if (!analysisData.success || !analysisData.data) {
            appendScanLog(
              `Analyzer lieferte keine Daten: ${analysisData.error || "unbekannter Fehler"}`,
              "error",
            );
            throw new Error(analysisData.error || "Analyzer returned no data");
          }
          appendScanLog(
            `Analyzer erfolgreich: ${analysisData.data.screens?.length ?? 0} Screens, ${analysisData.data.flows?.length ?? 0} Flows.`,
            "success",
          );
          if (analysisData.data.commitSha) {
            appendScanLog(`Analyzed commit: ${analysisData.data.commitSha}`, "info");
          }

          // Step: Capture screenshots for all detected screens
          let screensWithScreenshots: Screen[] = analysisData.data.screens || [];
          let graph = analysisData.data.graph;
          let quality = analysisData.data.quality;
          let runtime = undefined;
          let escalations = buildEscalationJobs(graph, runtime);

          const getPlaceholderUrl = (screen: Screen) =>
            `https://placehold.co/1200x800/1a1a1a/03ffa3?text=${encodeURIComponent(screen.name)}`;
          const applyPlaceholderScreens = (screens: Screen[]) =>
            screens.map((screen) => ({
              ...screen,
              screenshotUrl: getPlaceholderUrl(screen),
              screenshotStatus: "failed" as ScreenshotStatus,
            }));

          // ✅ TRY to capture screenshots, but fallback to placeholders on error
          if (activeProject.deployed_url && screensWithScreenshots.length > 0) {
            appendScanLog(
              `Screenshot-Phase gestartet (${screensWithScreenshots.length} Screen(s)) über ${activeProject.deployed_url}.`,
              "info",
            );
            try {
              const screenshotResponse = await fetch(
                `${supabaseUrl}/functions/v1/visudev-analyzer/screenshots`,
                {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${publicAnonKey}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    projectId: activeProject.id,
                    baseUrl: activeProject.deployed_url,
                    screens: screensWithScreenshots,
                  }),
                },
              );

              if (screenshotResponse.ok) {
                const screenshotData =
                  (await screenshotResponse.json()) as AnalyzerScreenshotsResponse;
                const results = screenshotData.data?.results ?? [];
                if (!screenshotData.success || !screenshotData.data) {
                  appendScanLog(
                    "Screenshot-Service gab kein valides Ergebnis zurück – nutze Platzhalterbilder.",
                    "error",
                  );
                  screensWithScreenshots = applyPlaceholderScreens(screensWithScreenshots);
                } else {
                  // Map screenshot URLs to screens
                  screensWithScreenshots = screensWithScreenshots.map((screen) => {
                    const result = results.find((item) => item.screenId === screen.id);
                    const status: ScreenshotStatus = result?.status === "ok" ? "ok" : "failed";
                    return {
                      ...screen,
                      screenshotUrl: result?.url ?? getPlaceholderUrl(screen),
                      screenshotStatus: status,
                    };
                  });
                  const okCount = screensWithScreenshots.filter(
                    (screen) => screen.screenshotStatus === "ok",
                  ).length;
                  const failedCount = screensWithScreenshots.length - okCount;
                  appendScanLog(
                    `Screenshots abgeschlossen: ${okCount} erfolgreich, ${failedCount} fehlgeschlagen.`,
                    failedCount > 0 ? "info" : "success",
                  );
                }
              } else {
                const errorText = await screenshotResponse.text();
                console.warn(
                  `⚠️ [VisuDEV] Screenshot API failed (${screenshotResponse.status}): ${errorText}`,
                );
                appendScanLog(
                  `Screenshot-API fehlgeschlagen (${screenshotResponse.status}) – nutze Platzhalterbilder.`,
                  "error",
                );
                // Fallback to placeholders
                screensWithScreenshots = applyPlaceholderScreens(screensWithScreenshots);
              }
            } catch (screenshotError) {
              const message =
                screenshotError instanceof Error
                  ? screenshotError.message
                  : String(screenshotError);
              console.error(`❌ [VisuDEV] Screenshot capture failed:`, message);
              appendScanLog(
                `Screenshot-Erfassung fehlgeschlagen (${message}) – nutze Platzhalterbilder.`,
                "error",
              );
              // Fallback to placeholders
              screensWithScreenshots = applyPlaceholderScreens(screensWithScreenshots);
            }
          } else {
            // No deployed URL - use placeholders
            screensWithScreenshots = applyPlaceholderScreens(screensWithScreenshots);
            if (!activeProject.deployed_url) {
              appendScanLog(
                "Keine Deployed-URL gesetzt – Screenshots werden als Platzhalter erzeugt.",
                "info",
              );
            } else {
              appendScanLog("Keine Screens erkannt – Screenshot-Phase übersprungen.", "info");
            }
          }

          if (screensWithScreenshots.length > 0 && activeProject.preview_mode !== "deployed") {
            appendScanLog(
              `Runtime-Crawl angefragt (${Math.min(screensWithScreenshots.length, 8)} Route-Screen(s)).`,
              "info",
            );
            const crawlResponse = await previewAPI.crawl(
              activeProject.id,
              {
                screens: screensWithScreenshots.map((screen) => ({
                  id: screen.id,
                  name: screen.name,
                  path: screen.path,
                  type: screen.type,
                  parentScreenId: screen.parentScreenId,
                  parentPath: screen.parentPath,
                  stateKey: screen.stateKey,
                })),
                maxScreens: 8,
                maxClicksPerScreen: 4,
              },
              activeProject.preview_mode,
            );
            if (crawlResponse.success && crawlResponse.data) {
              runtime = crawlResponse.data;
              screensWithScreenshots = applyRuntimeScreenshots(screensWithScreenshots, runtime);
              const merged = mergeRuntimeIntoAnalysis(graph, quality, runtime);
              graph = merged.graph;
              quality = merged.quality;
              escalations = buildEscalationJobs(graph, runtime);
              appendScanLog(
                `Runtime-Crawl abgeschlossen: ${runtime.summary.verifiedEdges} verifizierte Kanten, ${runtime.summary.stateCaptures} State-Captures.`,
                "success",
              );
              if (runtime.summary.mismatchCount > 0) {
                appendScanLog(
                  `Runtime-Crawl meldet ${runtime.summary.mismatchCount} Abweichung(en) zwischen DOM und Graph.`,
                  "info",
                );
              }
            } else if (crawlResponse.error) {
              appendScanLog(`Runtime-Crawl übersprungen: ${crawlResponse.error}`, "info");
            }
          }

          escalations = buildEscalationJobs(graph, runtime);

          // Transform analyzer result into AnalysisResult
          const result: AnalysisResult = {
            screens: screensWithScreenshots,
            flows: analysisData.data.flows || activeProject.flows,
            graph,
            quality,
            runtime,
            escalations,
            stats: {
              totalScreens: screensWithScreenshots.length,
              totalFlows: (analysisData.data.flows || activeProject.flows).length,
              maxDepth: Math.max(...screensWithScreenshots.map((screen) => screen.depth ?? 0), 0),
            },
          };

          // Update project with new screens/flows and analysis commit (for C1: Preview at exact SHA)
          const updatedProject: Project = {
            ...activeProject,
            screens: result.screens,
            flows: result.flows,
            lastAnalyzedCommitSha:
              analysisData.data.commitSha ?? activeProject.lastAnalyzedCommitSha,
            analysisGraph: graph,
            analysisQuality: quality,
            analysisRuntime: runtime,
            analysisEscalations: escalations,
          };

          updateProject(updatedProject);
          appendScanLog(
            `Analyse abgeschlossen: ${result.stats.totalScreens} Screens, ${result.stats.totalFlows} Flows, maxDepth ${result.stats.maxDepth}.`,
            "success",
          );

          // Update scan record
          setScans((prev) =>
            prev.map((scan) =>
              scan.id === scanId
                ? {
                    ...scan,
                    status: "completed",
                    progress: 100,
                    result,
                    completedAt: new Date().toISOString(),
                  }
                : scan,
            ),
          );

          setScanStatuses((prev) => ({
            ...prev,
            [type]: { status: "completed", progress: 100, message: "Analyse abgeschlossen" },
          }));
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          console.error(`❌ [VisuDEV] ${type} scan failed:`, message);
          appendScanLog(`Analyse fehlgeschlagen: ${message || "Unknown error"}`, "error");

          // Update scan record with error
          setScans((prev) =>
            prev.map((scan) =>
              scan.id === scanId
                ? {
                    ...scan,
                    status: "failed",
                    progress: 0,
                    errorMessage: message || "Unknown error",
                    completedAt: new Date().toISOString(),
                  }
                : scan,
            ),
          );

          setScanStatuses((prev) => ({
            ...prev,
            [type]: {
              status: "failed",
              progress: 0,
              message: "Analyse fehlgeschlagen",
              error: message || "Analysis failed",
            },
          }));

          // Use existing sample data as fallback
        }
      }
    },
    [activeProject, updateProject],
  );

  const startPreview = useCallback(
    async (projectId: string, repo?: string, branchOrCommit?: string, commitSha?: string) => {
      const setPreviewError = (error: string) => {
        setPreview((prev) => ({
          ...prev,
          projectId,
          runId: null,
          status: "failed" as const,
          error,
          previewUrl: null,
        }));
      };
      const previewMode = getProjectPreviewMode(projectId);
      if (previewMode === "deployed") {
        setPreviewError("Preview-Modus ist 'Deployed URL'. Bitte eine URL im Projekt setzen.");
        return;
      }
      const projectRecord = projects.find((p) => p.id === projectId);
      const sourceMode = projectRecord ? getProjectSourceMode(projectRecord) : "github";
      const localPath =
        sourceMode === "local" ? projectRecord?.local_path?.trim() || undefined : undefined;
      const effectiveRepo =
        repo ?? (sourceMode === "github" ? projectRecord?.github_repo : undefined);
      if (!localPath && !effectiveRepo) {
        setPreviewError("Keine Projektquelle: GitHub-Repo oder lokaler Pfad erforderlich.");
        return;
      }
      if (effectiveRepo) {
        if (effectiveRepo.startsWith("http://") || effectiveRepo.startsWith("https://")) {
          setPreviewError("Repo als 'owner/repo' angeben, keine URL.");
          return;
        }
        if (!effectiveRepo.includes("/")) {
          setPreviewError("Repo-Format: owner/repo (z. B. user/my-app).");
          return;
        }
      }
      const branch = (branchOrCommit ?? projectRecord?.github_branch ?? "").trim();
      if (!localPath && branch.startsWith("-")) {
        setPreviewError("Branch darf nicht mit - beginnen (z. B. -h, --help).");
        return;
      }
      const startLabel = localPath
        ? `lokaler Pfad ${localPath}`
        : `${effectiveRepo ?? "owner/repo"} @ ${branch || "main"}`;
      setPreview((prev) => ({
        ...prev,
        projectId,
        runId: null,
        status: "starting",
        previewUrl: null,
        error: null,
        refreshLogs: [makePreviewLog(`Start angefordert (${startLabel})`)],
        previewReadyAt: prev.projectId === projectId ? prev.previewReadyAt : null,
      }));
      await new Promise((r) => setTimeout(r, 0));
      try {
        const client = getVisuDevClient();
        const res = await client.startPreview(projectId, {
          projectId,
          repo: effectiveRepo,
          localPath,
          branchOrCommit: branchOrCommit ?? projectRecord?.github_branch,
          commitSha,
        });
        if (res.status === "failed") {
          setPreview((prev) =>
            prev.projectId === projectId
              ? {
                  ...prev,
                  status: "failed",
                  error: "Preview start failed",
                  refreshLogs: [
                    ...prev.refreshLogs,
                    makePreviewLog("Fehlgeschlagen (Start): Preview start failed"),
                  ],
                }
              : prev,
          );
          return;
        }
        const nextRunId = res.runId ?? null;
        const nextStatusRaw = res.status;
        const allowedPreviewStatuses: PreviewStatus[] = [
          "idle",
          "starting",
          "ready",
          "failed",
          "stopped",
        ];
        const nextStatus: PreviewStatus = allowedPreviewStatuses.includes(
          nextStatusRaw as PreviewStatus,
        )
          ? (nextStatusRaw as PreviewStatus)
          : "starting";
        const startMessage =
          res.reusedExistingRun === true
            ? `Start wiederverwendet. Aktiver Run: ${nextRunId ?? "unbekannt"} (${nextStatus}).`
            : `Start akzeptiert. Run: ${nextRunId ?? "unbekannt"}. Warte auf Build/Runner-Status …`;
        setPreview((prev) =>
          prev.projectId === projectId
            ? {
                ...prev,
                runId: nextRunId ?? prev.runId,
                status: nextStatus,
                refreshLogs: [...prev.refreshLogs, makePreviewLog(startMessage)],
              }
            : prev,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setPreview((prev) =>
          prev.projectId === projectId
            ? {
                ...prev,
                status: "failed",
                error: message || "Start failed",
                refreshLogs: [
                  ...prev.refreshLogs,
                  makePreviewLog(`Fehlgeschlagen (Start): ${message || "Start failed"}`),
                ],
              }
            : prev,
        );
      }
      // Keep status "starting"; UI will poll refreshPreviewStatus
    },
    [getProjectPreviewMode, makePreviewLog, projects],
  );

  const refreshPreviewStatus = useCallback(
    async (projectId: string): Promise<PreviewStatus | undefined> => {
      let res: Awaited<ReturnType<ReturnType<typeof getVisuDevClient>["getPreviewStatus"]>>;
      try {
        res = await getVisuDevClient().getPreviewStatus(projectId);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setPreview((prev) =>
          prev.projectId === projectId && prev.status === "starting"
            ? {
                ...prev,
                status: "failed" as const,
                error: message,
                previewUrl: null,
                refreshLogs: [
                  ...prev.refreshLogs,
                  makePreviewLog(`Fehlgeschlagen (Status): ${message}`),
                ],
              }
            : prev,
        );
        return undefined;
      }
      if (res.status === "failed" && res.error?.message) {
        const error = res.error.message;
        setPreview((prev) =>
          prev.projectId === projectId && prev.status === "starting"
            ? {
                ...prev,
                status: "failed" as const,
                error,
                previewUrl: null,
                refreshLogs: [
                  ...prev.refreshLogs,
                  makePreviewLog(`Fehlgeschlagen (Status): ${error}`),
                ],
              }
            : prev,
        );
        return undefined;
      }
      const payload = res;
      const status = (payload.status as PreviewStatus) ?? "idle";
      const payloadRunId =
        typeof payload.runId === "string" && payload.runId.trim() ? payload.runId : null;
      const logs: PreviewStepLog[] = [];
      setPreview((prev) =>
        prev.projectId !== projectId
          ? prev
          : prev.status === "failed" && status === "starting"
            ? {
                ...prev,
                // Do not override a local timeout/failure with stale "starting" responses.
                runId: payloadRunId ?? prev.runId,
                error: payload.error?.message ?? prev.error,
                refreshLogs: logs.length > 0 ? logs : prev.refreshLogs,
              }
            : {
                ...prev,
                runId:
                  status === "idle" || status === "stopped" ? null : (payloadRunId ?? prev.runId),
                status,
                previewUrl: status === "failed" ? null : (payload.previewUrl ?? prev.previewUrl),
                error: payload.error?.message ?? prev.error,
                refreshLogs: logs.length > 0 ? logs : prev.refreshLogs,
                previewReadyAt:
                  status === "ready" && prev.status !== "ready"
                    ? new Date().toISOString()
                    : prev.previewReadyAt,
              },
      );
      return status;
    },
    [makePreviewLog],
  );

  const stopPreview = useCallback(async (projectId: string) => {
    try {
      await getVisuDevClient().stopPreview(projectId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn("[VisuDEV] stopPreview failed (state reset anyway):", msg);
    } finally {
      setPreview((prev) =>
        prev.projectId === projectId
          ? {
              ...prev,
              runId: null,
              status: "stopped",
              previewUrl: null,
              error: null,
              refreshLogs: [],
            }
          : prev,
      );
    }
  }, []);

  const refreshPreview = useCallback(
    async (projectId: string) => {
      setPreview((prev) =>
        prev.projectId === projectId
          ? {
              ...prev,
              status: "starting",
              error: null,
              refreshLogs: [...prev.refreshLogs, makePreviewLog("Refresh angefordert …")],
            }
          : prev,
      );
      if (isLocalVisuDevMode()) {
        try {
          const project = projects.find((p) => p.id === projectId);
          await getVisuDevClient().startPreview(projectId, {
            projectId,
            localPath: project?.local_path,
            repo: project?.github_repo,
            branchOrCommit: project?.github_branch,
          });
          setPreview((prev) =>
            prev.projectId === projectId
              ? {
                  ...prev,
                  status: "starting",
                  error: null,
                  refreshLogs: [
                    ...prev.refreshLogs,
                    makePreviewLog("Refresh akzeptiert. Warte auf Status …"),
                  ],
                }
              : prev,
          );
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          setPreview((prev) =>
            prev.projectId === projectId
              ? {
                  ...prev,
                  status: "failed",
                  error: message,
                  refreshLogs: [
                    ...prev.refreshLogs,
                    makePreviewLog(`Fehlgeschlagen (Refresh): ${message}`),
                  ],
                }
              : prev,
          );
        }
        return;
      }
      const res = await previewAPI.refresh(projectId, getProjectPreviewMode(projectId));
      if (!res.success) {
        setPreview((prev) =>
          prev.projectId === projectId
            ? {
                ...prev,
                status: "failed",
                error: res.error ?? "Refresh failed",
                refreshLogs: [
                  ...prev.refreshLogs,
                  makePreviewLog(`Fehlgeschlagen (Refresh): ${res.error ?? "Refresh failed"}`),
                ],
              }
            : prev,
        );
        return;
      }
      setPreview((prev) =>
        prev.projectId === projectId
          ? {
              ...prev,
              status: "starting",
              error: null,
              refreshLogs: [
                ...prev.refreshLogs,
                makePreviewLog("Refresh akzeptiert. Warte auf Status …"),
              ],
            }
          : prev,
      );
    },
    [getProjectPreviewMode, makePreviewLog, projects],
  );

  const markPreviewStuck = useCallback(
    async (projectId: string, error: string) => {
      let stopSummary = "Timeout-Cleanup: aktive Projekt-Runs konnten nicht gestoppt werden.";
      try {
        if (isLocalVisuDevMode()) {
          await getVisuDevClient().stopPreview(projectId);
          stopSummary = "Timeout-Cleanup: Preview über Local Engine gestoppt.";
        } else {
          const stopRes = await previewAPI.stopProject(
            projectId,
            getProjectPreviewMode(projectId),
            previewAccessTokenRef.current ?? undefined,
          );
          stopSummary = stopRes.success
            ? `Timeout-Cleanup: ${stopRes.stopped ?? 0} aktive Projekt-Run(s) gestoppt.`
            : `Timeout-Cleanup fehlgeschlagen: ${stopRes.error ?? "Unbekannter Fehler"}`;
        }
      } catch (cleanupErr) {
        const msg = cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr);
        stopSummary = `Timeout-Cleanup fehlgeschlagen: ${msg}`;
      }

      setPreview((prev) =>
        prev.projectId === projectId && prev.status === "starting"
          ? {
              ...prev,
              runId: null,
              status: "failed" as const,
              error,
              previewUrl: null,
              refreshLogs: [
                ...prev.refreshLogs,
                makePreviewLog(`Fehlgeschlagen (Timeout): ${error}`),
                makePreviewLog(stopSummary),
              ],
            }
          : prev,
      );
    },
    [getProjectPreviewMode, makePreviewLog],
  );

  const value: VisudevStore = {
    projects,
    projectsLoading,
    setProjectsLoading,
    activeProject,
    setActiveProject,
    addProject,
    updateProject,
    deleteProject,
    loadProjects,
    scans,
    scanStatuses,
    startScan,
    refreshScanStatus,
    preview,
    startPreview,
    refreshPreviewStatus,
    refreshPreview,
    stopPreview,
    markPreviewStuck,
    setPreviewAccessToken,
  };

  return <VisudevContext.Provider value={value}>{children}</VisudevContext.Provider>;
}

export function useVisudev() {
  const ctx = useContext(VisudevContext);
  if (!ctx) {
    throw new Error("useVisudev must be used within VisudevProvider");
  }
  return ctx;
}

// Backwards compatibility alias for existing code
export const useProject = useVisudev;
