/**
 * Orchestrates graph-derived legacy Blueprint diagnostics.
 */

import type { SoftwareGraph } from "./software-graph.types.js";
import type {
  ProjectedCodeFact,
  ProjectedFinding,
  ProjectedRoute,
  ProjectedSecurityMatrixRow,
} from "./blueprint-graph-types.js";
import {
  MUTATING_METHODS,
  buildRouteFactsIndexes,
  inferRouteStates,
  type RouteInference,
} from "./blueprint-graph-inference.js";
import { deriveFactsFromGraph, deriveRoutesFromGraph } from "./blueprint-graph-routes.js";

export { deriveFactsFromGraph, deriveRoutesFromGraph } from "./blueprint-graph-routes.js";

function buildFindings(
  routes: ProjectedRoute[],
  routeFactsIndex: Map<string, ProjectedCodeFact[]>,
  factsByFilePath: Map<string, ProjectedCodeFact[]>,
  routeStates: Map<string, RouteInference>,
): ProjectedFinding[] {
  const findings: ProjectedFinding[] = [];
  for (const route of routes) {
    const routeFacts = routeFactsIndex.get(route.id) ?? [];
    const states = routeStates.get(route.id);
    if (states?.auth === "missing") {
      findings.push({
        id: `finding-auth-${route.id}`,
        ruleId: "visudev/missing-auth",
        category: "security",
        severity: MUTATING_METHODS.has(route.method) ? "medium" : "low",
        scopeId: route.id,
        message: `Kein Auth-Guard erkannt. In ${route.filePath}:${route.line} wurde bei der Registrierung dieser Route kein Auth-Guard gefunden. Wenn die Route absichtlich offen ist, ist das kein Fehler.`,
        expectedState: "protected",
        actualState: "unprotected",
        evidenceFactIds: routeFacts.map((fact) => fact.id),
        confidence: 0.6,
      });
    }
    if (states?.validation === "missing") {
      findings.push({
        id: `finding-validation-${route.id}`,
        ruleId: "visudev/missing-validation",
        category: "security",
        severity: MUTATING_METHODS.has(route.method) ? "medium" : "low",
        scopeId: route.id,
        message: `Keine Eingabeprüfung erkannt. In ${route.filePath}:${route.line} wurde keine Validierung der Eingabedaten gefunden.`,
        expectedState: "validated",
        actualState: "unvalidated",
        evidenceFactIds: routeFacts.map((fact) => fact.id),
        confidence: 0.55,
      });
    }
    for (const fact of factsByFilePath.get(route.filePath) ?? []) {
      if (fact.kind !== "autoguide:missing-aria-label") continue;
      findings.push({
        id: `finding-aria-${fact.id}`,
        ruleId: "visudev/missing-aria-label",
        category: "maintainability",
        severity: "low",
        scopeId: route.id,
        message: `Interactive element in ${fact.filePath} is missing an accessible label.`,
        expectedState: "labeled",
        actualState: "missing",
        evidenceFactIds: [fact.id],
        confidence: 0.8,
      });
    }
  }
  return findings;
}

function buildSecurityMatrix(
  routes: ProjectedRoute[],
  routeStates: Map<string, RouteInference>,
  findings: ProjectedFinding[],
): ProjectedSecurityMatrixRow[] {
  const findingCountByRoute = new Map<string, number>();
  for (const finding of findings) {
    findingCountByRoute.set(finding.scopeId, (findingCountByRoute.get(finding.scopeId) ?? 0) + 1);
  }

  return routes.map((route) => {
    const states = routeStates.get(route.id);
    return {
      routeId: route.id,
      method: route.method,
      path: route.path,
      auth: { state: states?.auth ?? "unknown" },
      role: { state: states?.role ?? "unknown" },
      validation: { state: states?.validation ?? "unknown" },
      rateLimit: { state: "n/a" },
      db: { state: states?.db ?? "unknown" },
      rls: { state: "n/a" },
      audit: { state: "n/a" },
      findingCount: findingCountByRoute.get(route.id) ?? 0,
    };
  });
}

export function deriveFindingsFromGraph(graph: SoftwareGraph): ProjectedFinding[] {
  return deriveDiagnosticsFromGraph(graph).findings;
}

export function deriveSecurityMatrixFromGraph(graph: SoftwareGraph): ProjectedSecurityMatrixRow[] {
  return deriveDiagnosticsFromGraph(graph).securityMatrix;
}

export function deriveDiagnosticsFromGraph(graph: SoftwareGraph): {
  routes: ProjectedRoute[];
  securityMatrix: ProjectedSecurityMatrixRow[];
  findings: ProjectedFinding[];
  facts: ProjectedCodeFact[];
} {
  const facts = deriveFactsFromGraph(graph);
  const routes = deriveRoutesFromGraph(graph);
  const indexes = buildRouteFactsIndexes(routes, facts);
  const routeStates = inferRouteStates(routes, indexes, graph);
  const findings = buildFindings(
    routes,
    indexes.routeFactsIndex,
    indexes.factsByFilePath,
    routeStates,
  );
  const securityMatrix = buildSecurityMatrix(routes, routeStates, findings);
  return { routes, securityMatrix, findings, facts };
}
