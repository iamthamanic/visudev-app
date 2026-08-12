/**
 * Graph-first blueprint enrichment: legacy diagnostics are derived from SoftwareGraph.
 * Also attaches stack-agnostic accessControlFindings / accessControlMatrix (Phase 1+).
 *
 * P0-6: analyzability for auth/validation states is computed inside
 * `buildRouteFactsIndexes` / `inferRouteStates` from per-file facts — no separate
 * enrichment flag is required when `scan.facts` already carry `kind`.
 */

import type { BlueprintDocument, RawBlueprintScan } from "../types/api.types.js";
import {
  deriveAccessControlMatrixFromFindings,
  deriveDiagnosticsFromGraph,
} from "../../../shared/blueprint.js";
import { enrichSoftwareGraphIfThin } from "../../../shared/demo-graph-thin.js";
import { analyzeApplicationChain } from "./access-control/app-chain-analyzer.service.js";
import {
  analyzeWithDatabaseSecurityAdapter,
  resolveDialectFromHints,
} from "./access-control/database-security-registry.js";
import { evaluateTenantIsolationPolicy } from "./access-control/tenant-isolation-policy.js";
import { buildSoftwareGraph } from "./software-graph-builder.service.js";

const DEFAULT_PROFILE = {
  appType: "saas",
  expectedUsers: "small",
  dataSensitivity: "low",
  deployment: "self-hosted",
};

export function enrichBlueprint(scan: RawBlueprintScan): BlueprintDocument {
  const built = buildSoftwareGraph(scan);
  // Opt-in only: avoids silently mixing demo fixtures into real thin scans.
  const demoEnrichmentEnabled = process.env.VISUDEV_DEMO_ENRICHMENT === "true";
  const graph = demoEnrichmentEnabled ? enrichSoftwareGraphIfThin(built, scan.projectId) : built;
  const { routes, securityMatrix, findings, facts } = deriveDiagnosticsFromGraph(graph);

  const appFindings = analyzeApplicationChain({ graph });
  const dialect = resolveDialectFromHints({
    frameworkHints: [scan.providerId],
  });
  const dbFindings = analyzeWithDatabaseSecurityAdapter({
    projectId: scan.projectId,
    dialect,
    facts: facts.map((f) => ({
      id: f.id,
      kind: f.kind,
      filePath: f.filePath,
      line: f.line,
      snippet: f.snippet,
    })),
    resourceIds: routes.map((r) => r.id),
  });
  const accessControlFindings = [...appFindings, ...dbFindings];
  const accessControlMatrix = deriveAccessControlMatrixFromFindings(
    routes.map((r) => ({ id: r.id, method: r.method, path: r.path })),
    accessControlFindings,
  );
  const tenantPolicyFindings = evaluateTenantIsolationPolicy(accessControlFindings);
  const mergedFindings = [
    ...findings,
    ...tenantPolicyFindings.map((f) => ({
      ...f,
      confidence: f.confidence / 100,
    })),
  ];

  return {
    version: 1,
    projectId: scan.projectId,
    repo: scan.localPath,
    analyzedAt: scan.analyzedAt,
    projectProfile: DEFAULT_PROFILE,
    routes,
    securityMatrix,
    findings: mergedFindings,
    facts,
    concepts: [],
    filesAnalyzed: scan.filesAnalyzed,
    frameworkHints: [scan.providerId],
    providerMetadata: scan.providerMetadata,
    graph,
    accessControlFindings,
    accessControlMatrix,
    databaseSecurityDialect: dialect,
  };
}
