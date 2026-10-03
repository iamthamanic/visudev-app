/**
 * Deno cloud adapter: VisuDev document → shared engine cutover (SDE-15).
 * Applies engine-projection graph to document.graph when resolve succeeds.
 * Secrets/tokens must never be passed into this module.
 * Location: src/supabase/functions/visudev-analyzer/module/blueprint/services/blueprint-engine-cutover.ts
 */

import type {
  BlueprintDocument,
  BlueprintEngineCutoverDto,
} from "../../dto/blueprint/blueprint-document.dto.ts";
import type { VisuDevGraph } from "../../dto/graph/visudev-graph.dto.ts";
import {
  adaptSoftwareGraphToVisuDevGraph,
  adaptVisuDevGraphToSoftwareGraph,
  isUsableVisuDevGraph,
} from "@visudev/shared/visudev-to-software-graph.ts";
import { applyEngineHostCutover } from "@visudev/shared/scan-detector/application/apply-engine-host-cutover.ts";

function readCloudAnalysisMode(): string | undefined {
  try {
    return Deno.env.get("VISUDEV_BLUEPRINT_ANALYSIS_MODE") ?? undefined;
  } catch {
    return undefined;
  }
}

function toDocumentGraph(
  raw: ReturnType<typeof adaptSoftwareGraphToVisuDevGraph>,
): VisuDevGraph {
  return {
    version: 1,
    nodes: raw.nodes as VisuDevGraph["nodes"],
    edges: raw.edges as VisuDevGraph["edges"],
    evidence: [],
    scopes: [],
    findings: [],
  };
}

/**
 * Attach shared engine cutover and promote engine graph to API authority (SDE-15).
 */
export function attachCloudEngineCutover(
  document: BlueprintDocument,
): BlueprintDocument {
  const modeRaw = readCloudAnalysisMode();

  if (!isUsableVisuDevGraph(document.graph)) {
    const empty = applyEngineHostCutover({
      host: "cloud",
      legacyGraph: {
        version: 1,
        projectId: document.projectId ?? document.repo,
        analyzedAt: document.analyzedAt,
        scopes: [],
        nodes: [],
        edges: [],
        evidence: [],
        groups: [],
        metrics: [],
        condensed: false,
        limits: { maxNodes: 2500, maxEdges: 5000 },
      },
      modeRaw,
      enrichment: "off",
    });
    const engineCutover: BlueprintEngineCutoverDto = {
      host: "cloud",
      mode: empty.mode,
      source: empty.resolved.source,
      fallbackUsed: empty.resolved.fallbackUsed,
      fallbackReason: empty.resolved.fallbackReason,
      parityStatus: empty.resolved.parity?.status,
      capabilitiesPresent: empty.capabilitiesPresent,
      capabilitiesAbsent: empty.capabilitiesAbsent,
      engineVersion: empty.engineVersion,
      semanticEntityCount: empty.semanticSystemModel.entities.length,
      semanticRelationCount: empty.semanticSystemModel.relations.length,
      note: "no-usable-visudev-graph",
    };
    return { ...document, engineCutover };
  }

  const legacyGraph = adaptVisuDevGraphToSoftwareGraph(document.graph, {
    projectId: document.projectId ?? document.repo,
    analyzedAt: document.analyzedAt,
    routes: document.routes.map((route) => ({
      id: route.id,
      method: route.method,
      path: route.path,
      filePath: route.filePath,
      line: route.line,
      pipeline: route.pipeline.map((node) => ({ kind: String(node.type) })),
    })),
  });

  const cutover = applyEngineHostCutover({
    host: "cloud",
    legacyGraph,
    modeRaw,
    enrichment: "off",
  });

  const engineCutover: BlueprintEngineCutoverDto = {
    host: "cloud",
    mode: cutover.mode,
    source: cutover.resolved.source,
    fallbackUsed: cutover.resolved.fallbackUsed,
    fallbackReason: cutover.resolved.fallbackReason,
    parityStatus: cutover.resolved.parity?.status,
    capabilitiesPresent: cutover.capabilitiesPresent,
    capabilitiesAbsent: cutover.capabilitiesAbsent,
    engineVersion: cutover.engineVersion,
    semanticEntityCount: cutover.semanticSystemModel.entities.length,
    semanticRelationCount: cutover.semanticSystemModel.relations.length,
  };

  if (
    cutover.resolved.source === "engine-projection" &&
    cutover.resolved.graph.nodes.length > 0
  ) {
    const projected = adaptSoftwareGraphToVisuDevGraph(cutover.resolved.graph);
    if (isUsableVisuDevGraph(projected)) {
      return {
        ...document,
        graph: toDocumentGraph(projected),
        engineCutover,
      };
    }
  }

  return { ...document, engineCutover };
}
