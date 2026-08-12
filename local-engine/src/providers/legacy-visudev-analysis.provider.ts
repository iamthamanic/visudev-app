/**
 * Legacy Blueprint analysis via Preview Runner /blueprint/analyze.
 * Returns a RawBlueprintScan so the shared enrichment pipeline can build the
 * canonical BlueprintDocument.
 * Location: local-engine/src/providers/legacy-visudev-analysis.provider.ts
 */

import type {
  BlueprintAnalysisProviderId,
  BlueprintDocument,
  FactSelectionReport,
  RawBlueprintRoute,
  RawBlueprintScan,
} from "../types/api.types.js";
import { isAnalysisOrigin } from "../services/analysis-origin.service.js";
import type { BlueprintProvider, BlueprintProviderInput } from "./blueprint-provider.interface.js";

type RunnerBlueprintResponse = {
  success?: boolean;
  data?: {
    blueprint?: BlueprintDocument;
    analysisId?: string;
    filesAnalyzed?: number;
    workspaceRoot?: string;
  };
  error?: string;
};

function isNonNegativeFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isFactSelectionReport(value: unknown): value is FactSelectionReport {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const report = value as Record<string, unknown>;
  if (
    !isNonNegativeFiniteNumber(report.extracted) ||
    !isNonNegativeFiniteNumber(report.selected) ||
    !isNonNegativeFiniteNumber(report.filesCovered)
  ) {
    return false;
  }
  const byKind = report.byKind;
  if (!byKind || typeof byKind !== "object" || Array.isArray(byKind)) return false;
  for (const entry of Object.values(byKind as Record<string, unknown>)) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return false;
    const row = entry as Record<string, unknown>;
    if (
      !isNonNegativeFiniteNumber(row.extracted) ||
      !isNonNegativeFiniteNumber(row.selected)
    ) {
      return false;
    }
  }
  return true;
}

export class LegacyVisuDevAnalysisProvider implements BlueprintProvider {
  readonly id: BlueprintAnalysisProviderId = "legacy-blueprint-runner";
  readonly name = "Legacy Blueprint Runner";

  constructor(private readonly runnerUrl: string) {}

  async scanProject(input: BlueprintProviderInput): Promise<RawBlueprintScan> {
    const localPath = input.localPath ?? input.project.localPath;
    if (!localPath) {
      throw Object.assign(new Error("Blueprint analysis requires a local project path."), {
        code: "MISSING_LOCAL_PATH",
      });
    }

    const response = await fetch(`${this.runnerUrl.replace(/\/$/, "")}/blueprint/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: input.projectId,
        localPath,
      }),
    });

    const text = await response.text();
    let payload: RunnerBlueprintResponse;
    try {
      payload = text ? (JSON.parse(text) as RunnerBlueprintResponse) : {};
    } catch {
      throw Object.assign(
        new Error("Preview Runner returned invalid JSON for blueprint analysis."),
        { code: "RUNNER_INVALID_JSON" },
      );
    }

    if (!response.ok || !payload.success || !payload.data?.blueprint) {
      const message = payload.error || `Runner error ${response.status}`;
      const code =
        response.status === 503
          ? "DENO_NOT_AVAILABLE"
          : response.status === 403
            ? "LOCAL_PATH_FORBIDDEN"
            : "BLUEPRINT_ANALYSIS_FAILED";
      throw Object.assign(new Error(message), { code });
    }

    const blueprint = payload.data.blueprint;
    const scanOrigin = isAnalysisOrigin(blueprint.analysisOrigin)
      ? blueprint.analysisOrigin
      : undefined;
    const rawRoutes = Array.isArray(blueprint.routes) ? blueprint.routes : [];
    const rawFacts = Array.isArray(blueprint.facts) ? blueprint.facts : [];
    const analyzedAt =
      typeof blueprint.analyzedAt === "string" ? blueprint.analyzedAt : new Date().toISOString();

    const routes: RawBlueprintRoute[] = rawRoutes.map((raw, index) => ({
      id: `legacy-route-${index + 1}`,
      method: typeof raw.method === "string" ? raw.method.toUpperCase() : "PAGE",
      path: typeof raw.path === "string" ? raw.path : "/",
      filePath: typeof raw.filePath === "string" ? raw.filePath : "",
      line: typeof raw.line === "number" ? raw.line : 1,
      pipeline: Array.isArray(raw.pipeline) ? raw.pipeline : [],
      concepts: raw.concepts && typeof raw.concepts === "object" ? raw.concepts : {},
    }));

    const facts = rawFacts.map((raw, index) => ({
      id: typeof raw.id === "string" ? raw.id : `legacy-fact-${index + 1}`,
      kind: typeof raw.kind === "string" ? raw.kind : "legacy:unknown",
      filePath: typeof raw.filePath === "string" ? raw.filePath : "",
      line: typeof raw.line === "number" ? raw.line : 1,
      snippet: typeof raw.snippet === "string" ? raw.snippet : String(raw.snippet ?? ""),
      metadata: raw.metadata && typeof raw.metadata === "object" ? raw.metadata : {},
    }));

    const factSelection = isFactSelectionReport(blueprint.factSelection)
      ? blueprint.factSelection
      : undefined;

    return {
      providerId: this.id,
      projectId: input.projectId,
      localPath,
      analyzedAt,
      routes,
      facts,
      factSelection,
      filesAnalyzed:
        typeof payload.data.filesAnalyzed === "number" ? payload.data.filesAnalyzed : routes.length,
      analysisOrigin: scanOrigin,
      providerMetadata: {
        legacy: {
          runnerAnalysisId: payload.data.analysisId,
          workspaceRoot: payload.data.workspaceRoot,
        },
      },
    };
  }
}
