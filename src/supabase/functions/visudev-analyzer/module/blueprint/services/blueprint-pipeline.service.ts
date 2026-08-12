/** Shared Blueprint pipeline: file entries → Facts → Concepts → Policies → Document. */

import type {
  BlueprintDocument,
  CodeFact,
  ProjectProfile,
} from "../../dto/blueprint/blueprint-document.dto.ts";
import { extractFactsFromFile } from "../facts/fact-extractors.ts";
import { createEmptyAstParseReport } from "../graph/ast-call-graph.ts";
import {
  applyFileLimitWithSeeds,
  collectRelatedFiles,
  type FileIndexEntry,
  prioritizeBlueprintFiles,
} from "../graph/call-graph.builder.ts";
import type { RouteScope } from "../../dto/blueprint/route-scope.dto.ts";
import {
  buildRouteScopeId,
  validateRouteScopes,
} from "../graph/route-scope.validate.ts";
import {
  MAX_BLUEPRINT_FACTS,
  sanitizeFactsForExport,
  selectFactsPreservingPrismaModels,
} from "../internal/export-sanitizer.ts";
import { buildConceptsForRoutes } from "./concept-engine.service.ts";
import {
  buildRouteBlueprints,
  buildSecurityMatrix,
  evaluatePolicies,
} from "./policy-engine.service.ts";
import { assembleBlueprintGraph } from "./blueprint-graph-assembly.ts";
import { attachGraphFindings } from "../graph/graph-policy-findings.ts";
import { resolveRoutePath } from "../internal/route-path.util.ts";
import {
  buildExpressMountPrefixByDir,
  joinMountPrefix,
  lookupExpressMountPrefix,
} from "../internal/route-mount.util.ts";

const DEFAULT_PROFILE: ProjectProfile = {
  appType: "saas",
  expectedUsers: "medium",
  dataSensitivity: "pii",
  deployment: "vercel",
};

export interface FileSourceEntry {
  path: string;
  content: string;
}

export interface AnalyzeBlueprintFromFilesInput {
  projectId?: string;
  repo: string;
  branch: string;
  commitSha: string;
  fileEntries: FileSourceEntry[];
  fileLimit?: number;
  projectProfile?: ProjectProfile;
}

export function isSupportedBlueprintFile(path: string): boolean {
  const ext = path.split(".").pop()?.toLowerCase();
  return Boolean(
    ext &&
      ["ts", "tsx", "js", "jsx", "vue", "py", "prisma", "yml", "yaml"].includes(
        ext,
      ),
  );
}

export function analyzeFromFileEntries(
  input: AnalyzeBlueprintFromFilesInput,
): BlueprintDocument {
  const fileLimit = Math.max(input.fileLimit ?? 250, 250);
  const prioritized = applyFileLimitWithSeeds(
    prioritizeBlueprintFiles(
      input.fileEntries.filter((entry) => isSupportedBlueprintFile(entry.path)),
    ),
    fileLimit,
  );

  // Resolution catalog: every supported path in the scan, not only the soft-capped
  // extract set — otherwise NodeNext `./x.js`→`x.ts` fails when x.ts is outside FILE_LIMIT.
  const resolutionPaths = new Set(
    input.fileEntries
      .filter((entry) => isSupportedBlueprintFile(entry.path))
      .map((entry) => entry.path),
  );

  const fileIndex = new Map<string, FileIndexEntry>();
  const allFacts: CodeFact[] = [];
  const astParseReport = createEmptyAstParseReport();
  let analyzed = 0;

  for (const file of prioritized) {
    fileIndex.set(file.path, { path: file.path, content: file.content });
  }

  for (const file of prioritized) {
    const facts = extractFactsFromFile(
      file.path,
      file.content,
      fileIndex,
      astParseReport,
      resolutionPaths,
    );
    allFacts.push(...facts);
    analyzed += 1;
  }

  const routeScopes = validateRouteScopes(
    buildRouteScopes(allFacts, fileIndex),
  );
  const { facts: cappedFacts, report: factSelection } =
    selectFactsPreservingPrismaModels(allFacts, MAX_BLUEPRINT_FACTS);
  const exportFacts = sanitizeFactsForExport(cappedFacts);
  const concepts = buildConceptsForRoutes(routeScopes, allFacts);
  const findings = evaluatePolicies(routeScopes, concepts, allFacts);
  let graph = assembleBlueprintGraph(exportFacts, routeScopes);
  const routes = buildRouteBlueprints(routeScopes, concepts, graph);
  const securityMatrix = buildSecurityMatrix(routes, findings, graph);
  graph = attachGraphFindings(graph, routes, routeScopes, allFacts, findings);

  return {
    version: 1,
    projectId: input.projectId,
    repo: input.repo,
    branch: input.branch,
    commitSha: input.commitSha,
    analyzedAt: new Date().toISOString(),
    projectProfile: input.projectProfile ?? DEFAULT_PROFILE,
    routes,
    securityMatrix,
    findings,
    facts: exportFacts,
    factSelection,
    astParseReport,
    concepts,
    graph,
    filesAnalyzed: analyzed,
    frameworkHints: detectFrameworkHints(allFacts),
  };
}

function buildRouteScopes(
  facts: CodeFact[],
  fileIndex: Map<string, FileIndexEntry>,
): RouteScope[] {
  const routeFacts = facts.filter((fact) => fact.kind === "api-route");
  const mountsByDir = buildExpressMountPrefixByDir(facts);
  const scopes: RouteScope[] = [];
  const seen = new Set<string>();
  const usedBaseIds = new Set<string>();

  for (const fact of routeFacts) {
    const method = String(fact.metadata.method ?? "GET").toUpperCase();
    const path = joinMountPrefix(
      lookupExpressMountPrefix(fact.filePath, mountsByDir),
      resolveRoutePath(fact),
    );
    const id = buildRouteScopeId(
      method,
      path,
      fact.filePath,
      fact.line,
      usedBaseIds,
    );
    if (seen.has(id)) continue;
    seen.add(id);

    const relatedFiles = collectRelatedFiles(fact.filePath, fileIndex);
    scopes.push({
      id,
      method,
      path,
      filePath: fact.filePath,
      line: fact.line,
      relatedFiles,
    });
  }

  return scopes.sort((a, b) => a.path.localeCompare(b.path));
}

function detectFrameworkHints(facts: CodeFact[]): string[] {
  const hints = new Set<string>();
  for (const fact of facts) {
    if (fact.metadata.framework) hints.add(String(fact.metadata.framework));
    if (fact.filePath.includes("supabase/functions")) {
      hints.add("supabase-edge");
    }
    const framework = String(fact.metadata.framework ?? "");
    // Legacy supabase.from() facts omit framework — do not tag mongodb/prisma/django as supabase.
    if (
      (fact.kind === "db-read" || fact.kind === "db-write") &&
      !framework
    ) {
      hints.add("supabase");
    }
  }
  return [...hints];
}
