/**
 * Resolve Blueprint SoftwareGraph via analysis mode (SDE-08).
 * Engine path materializes through Projection/Query — no parallel source scan.
 * Location: shared/scan-detector/application/resolve-blueprint-analysis.ts
 */

import type { ShadowParityResult } from "../../migration-baseline.types.js";
import type {
  SoftwareGraph,
  SoftwareGraphEdge,
  SoftwareGraphNode,
} from "../../software-graph.types.js";
import type { BlueprintAnalysisMode } from "../domain/blueprint-analysis-mode.js";
import {
  PROJECTION_HARD_MAX_LIMIT,
  type BlueprintProjectionReadModel,
} from "../domain/projection/types.js";
import type { ScanSnapshot } from "../types.js";
import { projectBlueprintReadModel } from "./project-read-models.js";
import { shadowCompareSoftwareGraphs } from "./shadow-compare-graphs.js";
import { softwareGraphToScanFacts } from "./software-graph-fact-bridge.js";

export type BlueprintAnalysisSource = "legacy" | "engine-projection" | "legacy-fallback";

export interface ResolveBlueprintAnalysisInput {
  mode: BlueprintAnalysisMode;
  /** Legacy SoftwareGraph from the existing builder (always available as fallback). */
  legacyGraph: SoftwareGraph;
  enrichment?: "off" | "on" | "unknown";
  routes?: ReadonlyArray<{ id?: string } | null> | null;
}

export interface ResolveBlueprintAnalysisResult {
  mode: BlueprintAnalysisMode;
  /** Graph authoritative for BlueprintDocument.graph rendering. */
  graph: SoftwareGraph;
  engineGraph: SoftwareGraph | null;
  parity: ShadowParityResult | null;
  source: BlueprintAnalysisSource;
  fallbackUsed: boolean;
  fallbackReason?: string;
  projectionTruncated: boolean;
}

function snapshotFromLegacyGraph(legacy: SoftwareGraph): ScanSnapshot {
  const bundle = softwareGraphToScanFacts(legacy);
  return {
    version: 1,
    projectId: legacy.projectId,
    analyzedAt: legacy.analyzedAt,
    enrichment: "off",
    repo: {},
    versions: {
      engineVersion: "0.1.0-sde",
      modelVersions: { softwareGraph: "1" },
      detectorVersions: { "static-blueprint-graph-v1": "1.0.0" },
    },
    capabilities: [],
    facts: bundle.facts,
    evidence: bundle.evidence,
  };
}

/**
 * Materialize a SoftwareGraph from a Blueprint projection read model.
 * Uses only projection entities/relations — product slices never see engine internals.
 */
export function softwareGraphFromBlueprintProjection(
  projection: BlueprintProjectionReadModel,
): SoftwareGraph {
  const nodes: SoftwareGraphNode[] = projection.entities.map((entity) => {
    const attrs = entity.attributes ?? {};
    const kindRaw = attrs.nodeKind;
    const kind =
      typeof kindRaw === "string" && kindRaw.length > 0
        ? (kindRaw as SoftwareGraphNode["kind"])
        : entity.kind.startsWith("graph-node:")
          ? (entity.kind.slice("graph-node:".length) as SoftwareGraphNode["kind"])
          : "file";
    const metadata: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(attrs)) {
      if (key.startsWith("meta:")) metadata[key.slice(5)] = value;
    }
    return {
      id: entity.subjectId,
      kind,
      label: entity.label,
      scopeId: typeof attrs.scopeId === "string" ? attrs.scopeId : undefined,
      filePath: typeof attrs.filePath === "string" ? attrs.filePath : undefined,
      line: typeof attrs.line === "number" ? attrs.line : undefined,
      metadata,
    };
  });

  const edges: SoftwareGraphEdge[] = projection.relations.map((relation) => {
    const edgeId = relation.id.startsWith("fact:edge:")
      ? relation.id.slice("fact:edge:".length)
      : relation.id;
    const kindRaw = relation.kind.startsWith("graph-edge:")
      ? relation.kind.slice("graph-edge:".length)
      : "references";
    return {
      id: edgeId,
      kind: kindRaw as SoftwareGraphEdge["kind"],
      sourceId: relation.sourceId,
      targetId: relation.targetId,
      metadata: {},
    };
  });

  nodes.sort((left, right) => left.id.localeCompare(right.id));
  edges.sort((left, right) => left.id.localeCompare(right.id));

  return {
    version: 1,
    projectId: projection.projectId,
    analyzedAt: projection.analyzedAt,
    scopes: [],
    nodes,
    edges,
    evidence: [],
    groups: [],
    metrics: [],
    condensed: false,
    limits: {
      maxNodes: Math.max(2500, nodes.length),
      maxEdges: Math.max(5000, edges.length),
    },
  };
}

/**
 * Build engine graph exclusively via Projection/Query from facts derived from
 * the strangler static adapter (no second independent Blueprint source scan).
 */
export function buildEngineGraphViaProjection(legacyGraph: SoftwareGraph): {
  engineGraph: SoftwareGraph;
  projectionTruncated: boolean;
} {
  const snapshot = snapshotFromLegacyGraph(legacyGraph);
  const projection = projectBlueprintReadModel({
    snapshot,
    scope: { projectId: legacyGraph.projectId },
    options: { limit: PROJECTION_HARD_MAX_LIMIT, offset: 0 },
  });
  return {
    engineGraph: softwareGraphFromBlueprintProjection(projection),
    projectionTruncated: projection.page.truncated || projection.page.hasMore,
  };
}

/**
 * Resolve which SoftwareGraph Blueprint should render, with shadow parity telemetry.
 */
export function resolveBlueprintAnalysis(
  input: ResolveBlueprintAnalysisInput,
): ResolveBlueprintAnalysisResult {
  const { mode, legacyGraph } = input;

  if (mode === "legacy") {
    return {
      mode,
      graph: legacyGraph,
      engineGraph: null,
      parity: null,
      source: "legacy",
      fallbackUsed: false,
      projectionTruncated: false,
    };
  }

  try {
    const { engineGraph, projectionTruncated } = buildEngineGraphViaProjection(legacyGraph);
    const parity = shadowCompareSoftwareGraphs({
      projectId: legacyGraph.projectId,
      legacy: legacyGraph,
      engine: engineGraph,
      enrichment: input.enrichment ?? "off",
      routes: input.routes,
    });

    if (mode === "shadow") {
      return {
        mode,
        graph: legacyGraph,
        engineGraph,
        parity,
        source: "legacy",
        fallbackUsed: false,
        projectionTruncated,
      };
    }

    // engine mode — projection-backed graph is authoritative
    if (projectionTruncated) {
      return {
        mode,
        graph: legacyGraph,
        engineGraph,
        parity,
        source: "legacy-fallback",
        fallbackUsed: true,
        fallbackReason: "engine projection truncated; refusing silent partial cutover",
        projectionTruncated: true,
      };
    }

    return {
      mode,
      graph: engineGraph,
      engineGraph,
      parity,
      source: "engine-projection",
      fallbackUsed: false,
      projectionTruncated: false,
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "engine projection failed";
    return {
      mode,
      graph: legacyGraph,
      engineGraph: null,
      parity: null,
      source: "legacy-fallback",
      fallbackUsed: true,
      fallbackReason: reason,
      projectionTruncated: false,
    };
  }
}
