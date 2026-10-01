/**
 * Route and fact extraction from SoftwareGraph.
 */

import type { SoftwareGraph } from "./software-graph.types.js";
import type {
  ConceptState,
  ProjectedCodeFact,
  ProjectedPipelineNode,
  ProjectedRoute,
} from "./blueprint-graph-types.js";

const CONCEPT_STATES = new Set<ConceptState>([
  "confirmed",
  "partial",
  "weak",
  "missing",
  "unknown",
  "contradictory",
]);

/** Keep Meteor METHOD/PUBLISH (and HTTP verbs); unknown → PAGE for UI pages. */
export function normalizeRouteMethod(method: unknown): string {
  const ROUTE_METHODS = new Set([
    "GET",
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
    "HEAD",
    "OPTIONS",
    "PAGE",
    "METHOD",
    "PUBLISH",
    "API",
  ]);
  const raw = typeof method === "string" ? method.trim().toUpperCase() : "";
  return ROUTE_METHODS.has(raw) ? raw : "PAGE";
}

export function normalizeRoutePath(path: unknown): string {
  if (typeof path !== "string") return "/";
  const trimmed = path.trim();
  if (!trimmed) return "/";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function normalizePipelineState(value: unknown): ConceptState {
  return typeof value === "string" && CONCEPT_STATES.has(value as ConceptState)
    ? (value as ConceptState)
    : "unknown";
}

/** Coerce Deno/legacy pipeline payloads into ProjectedPipelineNode[]. */
export function normalizeProjectedPipeline(raw: unknown): ProjectedPipelineNode[] {
  if (!Array.isArray(raw)) return [];
  const steps: ProjectedPipelineNode[] = [];
  for (const [index, entry] of raw.entries()) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const row = entry as Record<string, unknown>;
    const type =
      typeof row.type === "string"
        ? row.type
        : typeof row.kind === "string"
          ? row.kind
          : "step";
    const id =
      typeof row.id === "string" && row.id.trim().length > 0
        ? row.id
        : `pipeline-step-${index + 1}`;
    const label =
      typeof row.label === "string" && row.label.trim().length > 0 ? row.label : type;
    steps.push({
      id,
      type,
      label,
      state: normalizePipelineState(row.state),
      filePath: typeof row.filePath === "string" ? row.filePath : undefined,
      line: typeof row.line === "number" ? row.line : undefined,
    });
  }
  return steps;
}

export function deriveFactsFromGraph(graph: SoftwareGraph): ProjectedCodeFact[] {
  return graph.evidence.map((evidence) => ({
    id: evidence.factId,
    kind: evidence.kind,
    filePath: evidence.filePath,
    line: evidence.line,
    snippet: evidence.excerpt,
    metadata: {},
  }));
}

export function deriveRoutesFromGraph(graph: SoftwareGraph): ProjectedRoute[] {
  const routes: ProjectedRoute[] = [];
  for (const node of graph.nodes) {
    if (node.kind !== "route") continue;
    if (!node.filePath || node.line == null) continue;
    const routeId =
      typeof node.metadata.routeId === "string" && node.metadata.routeId.length > 0
        ? node.metadata.routeId
        : node.id;
    routes.push({
      id: routeId,
      method: normalizeRouteMethod(node.metadata.method),
      path: normalizeRoutePath(node.metadata.path),
      filePath: node.filePath,
      line: node.line,
      pipeline: normalizeProjectedPipeline(node.metadata.pipeline),
      concepts: {},
    });
  }
  return routes;
}
