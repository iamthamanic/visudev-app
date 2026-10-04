/**
 * Optional runtime crawl after local App Flow analysis.
 * Location: src/lib/visudev/run-local-appflow-crawl.ts
 */

import { getVisuDevClient } from "../visudev-api";
import type { VisuDevApiClient } from "../visudev-api/client";
import { mergeRuntimeIntoAnalysis } from "./runtime-crawl";
import type { Project, Screen } from "./types";

type AppflowAnalysisPayload = {
  screens: unknown[];
  flows: unknown[];
  graph?: unknown;
  quality?: unknown;
  commitSha?: string;
  summary?: {
    screensDetected?: number;
    flowsDetected?: number;
  };
};

type CrawlLog = (message: string, logType?: "info" | "success" | "error") => void;

export async function runLocalAppflowCrawlIfNeeded(
  project: Project,
  result: AppflowAnalysisPayload,
  appendScanLog: CrawlLog,
  updateProject: (project: Project) => Promise<void>,
  client: VisuDevApiClient = getVisuDevClient(),
): Promise<Project> {
  let screens = result.screens as Screen[];
  const flows = result.flows as Project["flows"];
  let graph = result.graph as Project["analysisGraph"];
  let quality = result.quality as Project["analysisQuality"];
  let runtime: Project["analysisRuntime"] | undefined;

  if (screens.length > 0 && project.preview_mode !== "deployed" && project.local_path) {
    appendScanLog(
      `Runtime-Crawl angefragt (Frontier, bis zu ${Math.min(screens.length, 40)} Seed-Route(s)) über Local Engine.`,
      "info",
    );
    try {
      let previewStatus = await client.getPreviewStatus(project.id);
      if (previewStatus.status !== "ready") {
        appendScanLog("Preview wird für Runtime-Crawl gestartet …", "info");
        await client.startPreview(project.id, {
          projectId: project.id,
          localPath: project.local_path,
          branchOrCommit: project.github_branch,
          commitSha: result.commitSha ?? project.lastAnalyzedCommitSha,
        });
        const previewDeadline = Date.now() + 420_000;
        while (Date.now() < previewDeadline) {
          previewStatus = await client.getPreviewStatus(project.id);
          if (previewStatus.status === "ready") break;
          if (previewStatus.status === "failed") {
            throw new Error("Preview start failed before crawl.");
          }
          await new Promise((resolve) => setTimeout(resolve, 2500));
        }
      }

      if (previewStatus.status === "ready") {
        const crawlResult = await client.crawlPreview(project.id, {
          screens: screens.map((screen) => ({
            id: screen.id,
            name: screen.name,
            path: screen.path,
            type: screen.type,
            parentScreenId: screen.parentScreenId,
            parentPath: screen.parentPath,
            stateKey: screen.stateKey,
          })),
          // maxScreens = visit budget ceiling (legacy name); frontier explores beyond seed slice.
          maxScreens: 40,
          maxClicksPerScreen: 5,
        });
        runtime = crawlResult.runtime as unknown as Project["analysisRuntime"];
        screens = crawlResult.screens as Screen[];
        const merged = mergeRuntimeIntoAnalysis(graph, quality, runtime);
        graph = merged.graph;
        quality = merged.quality;
        appendScanLog(
          `Runtime-Crawl abgeschlossen: ${runtime?.summary?.verifiedEdges ?? 0} verifizierte Kanten, ${runtime?.summary?.stateCaptures ?? 0} State-Captures.`,
          "success",
        );
      } else {
        appendScanLog("Runtime-Crawl übersprungen: Preview nicht bereit.", "info");
      }
    } catch (crawlError) {
      const message = crawlError instanceof Error ? crawlError.message : String(crawlError);
      appendScanLog(`Runtime-Crawl übersprungen: ${message}`, "info");
    }
  }

  const updatedProject: Project = {
    ...project,
    screens,
    flows,
    lastAnalyzedCommitSha: result.commitSha ?? project.lastAnalyzedCommitSha,
    analysisGraph: graph,
    analysisQuality: quality,
    analysisRuntime: runtime,
  };
  await updateProject(updatedProject);
  if (result.summary) {
    appendScanLog(
      `App Flow: ${result.summary.screensDetected ?? screens.length} Screens, ${result.summary.flowsDetected ?? flows.length} Flows.`,
      "success",
    );
  }
  return updatedProject;
}
