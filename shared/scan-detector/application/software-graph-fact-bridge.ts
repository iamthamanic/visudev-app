/**
 * Bridge SoftwareGraph ↔ ScanFact for static detector migration (SDE-06).
 * Location: shared/scan-detector/application/software-graph-fact-bridge.ts
 */

import type {
  SoftwareGraph,
  SoftwareGraphEdge,
  SoftwareGraphNode,
} from "../../software-graph.types.js";
import type { ScanEvidence, ScanFact } from "../types.js";

export interface SoftwareGraphFactBundle {
  facts: ScanFact[];
  evidence: ScanEvidence[];
}

function nodeFact(node: SoftwareGraphNode, detectorId: string): ScanFact {
  const metaEntries = Object.entries(node.metadata ?? {}).filter(
    ([, value]) =>
      typeof value === "string" || typeof value === "number" || typeof value === "boolean",
  );
  return {
    id: `fact:node:${node.id}`,
    kind: `graph-node:${node.kind}`,
    status: "detected",
    confidence: 1,
    provenance: { originKind: "static", detectorId },
    subjectId: node.id,
    evidenceIds: [`ev:node:${node.id}`],
    attributes: {
      label: node.label,
      nodeKind: node.kind,
      ...(node.filePath ? { filePath: node.filePath } : {}),
      ...(typeof node.line === "number" ? { line: node.line } : {}),
      ...(node.scopeId ? { scopeId: node.scopeId } : {}),
      ...Object.fromEntries(metaEntries.map(([key, value]) => [`meta:${key}`, value])),
    },
  };
}

function edgeFact(edge: SoftwareGraphEdge, detectorId: string): ScanFact {
  return {
    id: `fact:edge:${edge.id}`,
    kind: `graph-edge:${edge.kind}`,
    status: "detected",
    confidence: 1,
    provenance: { originKind: "static", detectorId },
    subjectId: edge.sourceId,
    objectId: edge.targetId,
    evidenceIds: [`ev:edge:${edge.id}`],
    attributes: {
      edgeKind: edge.kind,
      edgeId: edge.id,
    },
  };
}

/** Project an existing SoftwareGraph into engine facts (adapter, not re-detection). */
export function softwareGraphToScanFacts(
  graph: SoftwareGraph,
  detectorId = "static-blueprint-graph-v1",
): SoftwareGraphFactBundle {
  const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
  const edges = Array.isArray(graph.edges) ? graph.edges : [];
  const facts: ScanFact[] = [
    ...nodes.map((node) => nodeFact(node, detectorId)),
    ...edges.map((edge) => edgeFact(edge, detectorId)),
  ];
  const evidence: ScanEvidence[] = [
    ...nodes.map(
      (node): ScanEvidence => ({
        id: `ev:node:${node.id}`,
        kind: "graph-node",
        status: "detected",
        confidence: 1,
        provenance: { originKind: "static", detectorId },
        payload: {
          summary: node.label,
          filePath: node.filePath,
          line: node.line,
        },
        factIds: [`fact:node:${node.id}`],
      }),
    ),
    ...edges.map(
      (edge): ScanEvidence => ({
        id: `ev:edge:${edge.id}`,
        kind: "graph-edge",
        status: "detected",
        confidence: 1,
        provenance: { originKind: "static", detectorId },
        payload: {
          summary: `${edge.kind}:${edge.sourceId}->${edge.targetId}`,
        },
        factIds: [`fact:edge:${edge.id}`],
      }),
    ),
  ];
  return { facts, evidence };
}

/**
 * Rebuild a SoftwareGraph shell from engine graph facts.
 * Preserves node/edge identity needed for SDE-01 semantic baseline parity.
 */
export function scanFactsToSoftwareGraph(
  projectId: string,
  analyzedAt: string,
  facts: readonly ScanFact[],
): SoftwareGraph {
  const nodes: SoftwareGraphNode[] = [];
  const edges: SoftwareGraphEdge[] = [];

  for (const fact of facts) {
    if (fact.kind.startsWith("graph-node:")) {
      const kind = (fact.attributes?.nodeKind as SoftwareGraphNode["kind"] | undefined) ?? "file";
      const metadata: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(fact.attributes ?? {})) {
        if (key.startsWith("meta:")) metadata[key.slice(5)] = value;
      }
      nodes.push({
        id: fact.subjectId,
        kind,
        label: typeof fact.attributes?.label === "string" ? fact.attributes.label : fact.subjectId,
        scopeId: typeof fact.attributes?.scopeId === "string" ? fact.attributes.scopeId : undefined,
        filePath:
          typeof fact.attributes?.filePath === "string" ? fact.attributes.filePath : undefined,
        line: typeof fact.attributes?.line === "number" ? fact.attributes.line : undefined,
        metadata,
      });
      continue;
    }
    if (fact.kind.startsWith("graph-edge:") && fact.objectId) {
      const kind =
        (fact.attributes?.edgeKind as SoftwareGraphEdge["kind"] | undefined) ?? "references";
      const id =
        typeof fact.attributes?.edgeId === "string"
          ? fact.attributes.edgeId
          : fact.id.replace(/^fact:edge:/, "");
      edges.push({
        id,
        kind,
        sourceId: fact.subjectId,
        targetId: fact.objectId,
        metadata: {},
      });
    }
  }

  nodes.sort((left, right) => left.id.localeCompare(right.id));
  edges.sort((left, right) => left.id.localeCompare(right.id));

  return {
    version: 1,
    projectId,
    analyzedAt,
    scopes: [],
    nodes,
    edges,
    evidence: [],
    groups: [],
    metrics: [],
    condensed: false,
    limits: { maxNodes: Math.max(2500, nodes.length), maxEdges: Math.max(5000, edges.length) },
  };
}
