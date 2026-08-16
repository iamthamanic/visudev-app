import type { BlueprintData, SoftwareGraph } from "./types";

const DEPENDENCY_EDGE_KINDS = new Set([
  "references",
  "implements",
  "imports",
  "calls",
  "api",
  "event",
  "data",
  "external-dependency",
  "authenticates",
  "validates",
]);

export interface CanonicalBlueprintMetrics {
  /** Number of source files analyzed. Prefer explicit scan metadata over graph file metrics/nodes. */
  files: number;
  /** Exact SoftwareGraph nodes whose kind is `module`. */
  modules: number;
  /** Exact SoftwareGraph nodes whose kind is `service`. */
  services: number;
  /** Exact SoftwareGraph nodes whose kind is `domain`. */
  domains: number;
  /** Exact SoftwareGraph nodes whose kind is `route`. */
  routes: number;
  /** Non-containment graph relationships used as code/system dependencies. */
  dependencies: number;
  /** High + critical findings from the current Blueprint result. */
  criticalFindings: number;
  /** Real analyzer coverage metric only; null means unknown. */
  coveragePercent: number | null;
}

function metricValue(graph: SoftwareGraph, name: string): number | null {
  const metrics = Array.isArray(graph.metrics) ? graph.metrics : [];
  const match = metrics.find((metric) => metric.name === name);
  if (!match || typeof match.value !== "number" || !Number.isFinite(match.value)) return null;
  return Math.max(0, Math.round(match.value));
}

function countNodeKind(graph: SoftwareGraph, kind: string): number {
  const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
  return nodes.filter((node) => node.kind === kind).length;
}

export function computeCanonicalBlueprintMetrics(
  graph: SoftwareGraph | null | undefined,
  options: {
    filesAnalyzed?: number;
    findings?: BlueprintData["findings"];
  } = {},
): CanonicalBlueprintMetrics {
  if (!graph) {
    return {
      files: Math.max(0, Math.round(options.filesAnalyzed ?? 0)),
      modules: 0,
      services: 0,
      domains: 0,
      routes: 0,
      dependencies: 0,
      criticalFindings:
        options.findings?.filter(
          (finding) => finding.severity === "high" || finding.severity === "critical",
        ).length ?? 0,
      coveragePercent: null,
    };
  }

  const edges = Array.isArray(graph.edges) ? graph.edges : [];
  const explicitFiles = options.filesAnalyzed && options.filesAnalyzed > 0 ? options.filesAnalyzed : null;
  const files =
    explicitFiles ??
    metricValue(graph, "files") ??
    countNodeKind(graph, "file");
  const coverage = metricValue(graph, "coverage");

  return {
    files,
    modules: countNodeKind(graph, "module"),
    services: countNodeKind(graph, "service"),
    domains: countNodeKind(graph, "domain"),
    routes: countNodeKind(graph, "route"),
    dependencies: edges.filter((edge) => DEPENDENCY_EDGE_KINDS.has(edge.kind)).length,
    criticalFindings:
      options.findings?.filter(
        (finding) => finding.severity === "high" || finding.severity === "critical",
      ).length ?? 0,
    coveragePercent: coverage == null ? null : Math.min(100, coverage),
  };
}

export function canonicalMetricsFromBlueprint(
  blueprint: BlueprintData | null | undefined,
): CanonicalBlueprintMetrics {
  return computeCanonicalBlueprintMetrics(blueprint?.graph, {
    filesAnalyzed: blueprint?.filesAnalyzed,
    findings: blueprint?.findings,
  });
}
