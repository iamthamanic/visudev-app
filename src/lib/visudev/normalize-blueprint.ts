/**
 * Normalize partial/legacy Blueprint KV payloads for UI consumption.
 * Location: src/lib/visudev/normalize-blueprint.ts
 */

import { synthesizeSecurityMatrixFromAccessControl } from "../../../shared/synthesize-security-matrix.js";
import type { BlueprintData } from "./blueprint-types";
import {
  sanitizeAccessControlFindings,
  sanitizeAccessControlMatrix,
  sanitizeFacts,
  sanitizeFindings,
  sanitizeRoutes,
  sanitizeSecurityMatrix,
  sanitizeStringList,
} from "./normalize-blueprint-guards";
import { enrichSoftwareGraphIfThin } from "../../../shared/demo-graph-thin.js";
import { normalizeSoftwareGraph } from "./normalize-software-graph";
import { deriveDiagnosticsFromGraph } from "./software-graph-projections";

const EMPTY: BlueprintData = {
  version: 1,
  routes: [],
  securityMatrix: [],
  findings: [],
  facts: [],
  frameworkHints: [],
  filesAnalyzed: 0,
};

export function normalizeBlueprintData(
  raw: Record<string, unknown> | BlueprintData | null | undefined,
): BlueprintData {
  if (!raw || typeof raw !== "object") {
    return { ...EMPTY };
  }

  const projectId = typeof raw.projectId === "string" ? raw.projectId : "demo-project";
  const normalizedGraph = normalizeSoftwareGraph(raw.graph);
  const shouldEnrichDemo = import.meta.env.VITE_BLUEPRINT_DEMO_ENRICHMENT === "true";
  const graph =
    normalizedGraph && shouldEnrichDemo
      ? enrichSoftwareGraphIfThin(normalizedGraph, projectId)
      : normalizedGraph;
  const graphDiagnostics = graph ? deriveDiagnosticsFromGraph(graph) : null;

  const legacyRoutes = sanitizeRoutes(raw.routes);
  const legacySecurityMatrix = sanitizeSecurityMatrix(raw.securityMatrix);
  const legacyFindings = sanitizeFindings(raw.findings);
  const legacyFacts = sanitizeFacts(raw.facts);

  // Prefer a coherent diagnostics package: either richer legacy demo data or
  // graph-derived diagnostics — never mix arrays independently (scope alignment).
  const graphRoutes = graphDiagnostics?.routes ?? [];
  const graphMatrix = graphDiagnostics?.securityMatrix ?? [];
  const graphFindings = graphDiagnostics?.findings ?? [];
  const graphFacts = graphDiagnostics?.facts ?? [];
  const legacyDiagnosticsScore =
    legacyRoutes.length + legacySecurityMatrix.length + legacyFindings.length + legacyFacts.length;
  const graphDiagnosticsScore =
    graphRoutes.length + graphMatrix.length + graphFindings.length + graphFacts.length;
  const useLegacyDiagnostics = !graph || legacyDiagnosticsScore > graphDiagnosticsScore;

  const accessControlMatrix = (() => {
    const matrix = sanitizeAccessControlMatrix(raw.accessControlMatrix);
    return matrix.length > 0 ? matrix : undefined;
  })();
  const accessControlFindings = (() => {
    const findings = sanitizeAccessControlFindings(raw.accessControlFindings);
    return findings.length > 0 ? findings : undefined;
  })();

  let securityMatrix = useLegacyDiagnostics ? legacySecurityMatrix : graphMatrix;
  if (securityMatrix.length === 0 && accessControlMatrix) {
    securityMatrix = synthesizeSecurityMatrixFromAccessControl(accessControlMatrix);
  }

  return {
    version: raw.version === 1 ? 1 : 1,
    projectId: typeof raw.projectId === "string" ? raw.projectId : undefined,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : undefined,
    commitSha: typeof raw.commitSha === "string" ? raw.commitSha : undefined,
    analyzedAt: typeof raw.analyzedAt === "string" ? raw.analyzedAt : undefined,
    routes: useLegacyDiagnostics ? legacyRoutes : graphRoutes,
    securityMatrix,
    accessControlFindings,
    accessControlMatrix,
    findings: useLegacyDiagnostics ? legacyFindings : graphFindings,
    facts: useLegacyDiagnostics ? legacyFacts : graphFacts,
    frameworkHints: sanitizeStringList(raw.frameworkHints),
    filesAnalyzed:
      typeof raw.filesAnalyzed === "number" && Number.isFinite(raw.filesAnalyzed)
        ? raw.filesAnalyzed
        : 0,
    totalFiles:
      typeof raw.totalFiles === "number" && Number.isFinite(raw.totalFiles)
        ? raw.totalFiles
        : typeof (raw as { filesDiscovered?: unknown }).filesDiscovered === "number"
          ? ((raw as { filesDiscovered: number }).filesDiscovered)
          : undefined,
    truncation:
      raw.truncation && typeof raw.truncation === "object" && !Array.isArray(raw.truncation)
        ? (raw.truncation as BlueprintData["truncation"])
        : undefined,
    semanticSystemModel:
      raw.semanticSystemModel &&
      typeof raw.semanticSystemModel === "object" &&
      !Array.isArray(raw.semanticSystemModel)
        ? (raw.semanticSystemModel as BlueprintData["semanticSystemModel"])
        : undefined,
    repo: typeof raw.repo === "string" ? raw.repo : undefined,
    repoUrl: typeof raw.repoUrl === "string" ? raw.repoUrl : undefined,
    violations: Array.isArray(raw.violations) ? raw.violations : undefined,
    cycles: Array.isArray(raw.cycles) ? raw.cycles : undefined,
    graph,
  };
}
