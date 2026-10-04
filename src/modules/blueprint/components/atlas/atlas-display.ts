/**
 * Atlas display helpers — kind labels, dependencies, clusters, deployment hints.
 */

import type { SoftwareGraph, SoftwareGraphGroup, SoftwareGraphNode } from "../../types";

export const ATLAS_KIND_LABELS: Record<string, string> = {
  organization: "Organisation",
  application: "Anwendung",
  "business-domain": "Fachdomäne",
  capability: "Capability",
  resource: "Ressource",
  "technical-module": "Technisches Modul",
  endpoint: "Endpoint",
  "data-store": "Datenspeicher",
  "external-system": "Externes System",
  "security-control": "Security Control",
  "deployment-unit": "Deployment",
  "execution-flow": "Execution Flow",
  domain: "Fachdomäne",
  layer: "Layer",
  module: "Modul",
  route: "Route",
  service: "Service",
  repository: "Repository",
  table: "Datenbank",
  external: "Extern",
  file: "Datei",
  symbol: "Symbol",
  runtime: "Laufzeit",
};

export function atlasKindLabel(kind: string): string {
  return ATLAS_KIND_LABELS[kind] ?? kind;
}

export function findGraphNode(graph: SoftwareGraph, nodeId: string): SoftwareGraphNode | null {
  const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
  return nodes.find((node) => node.id === nodeId) ?? null;
}

export function listOutgoingDependencies(graph: SoftwareGraph, nodeId: string): string[] {
  const edges = Array.isArray(graph.edges) ? graph.edges : [];
  const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
  const nodeById = new Map(nodes.map((entry) => [entry.id, entry]));

  return edges
    .filter(
      (edge) => edge.sourceId === nodeId && edge.kind !== "contains" && nodeById.has(edge.targetId),
    )
    .map((edge) => {
      const target = nodeById.get(edge.targetId);
      return target ? `${edge.kind} → ${target.label}` : edge.kind;
    });
}

export function listIncomingDependencies(graph: SoftwareGraph, nodeId: string): string[] {
  const edges = Array.isArray(graph.edges) ? graph.edges : [];
  const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
  const nodeById = new Map(nodes.map((entry) => [entry.id, entry]));

  return edges
    .filter(
      (edge) => edge.targetId === nodeId && edge.kind !== "contains" && nodeById.has(edge.sourceId),
    )
    .map((edge) => {
      const source = nodeById.get(edge.sourceId);
      return source ? `${source.label} → ${edge.kind}` : edge.kind;
    });
}

export function findGroupsForNode(graph: SoftwareGraph, nodeId: string): SoftwareGraphGroup[] {
  const groups = Array.isArray(graph.groups) ? graph.groups : [];
  return groups.filter((group) => group.nodeIds.includes(nodeId));
}

export function listVisibleGroups(
  graph: SoftwareGraph,
  visibleNodeIds: Set<string>,
): SoftwareGraphGroup[] {
  const groups = Array.isArray(graph.groups) ? graph.groups : [];
  return groups.filter((group) => group.nodeIds.some((id) => visibleNodeIds.has(id)));
}

export function listDeploymentHints(graph: SoftwareGraph, node: SoftwareGraphNode): string[] {
  const hints = new Set<string>();
  const metadataRuntime = node.metadata.runtime;
  if (typeof metadataRuntime === "string" && metadataRuntime.trim()) {
    hints.add(metadataRuntime);
  }

  for (const group of findGroupsForNode(graph, node.id)) {
    if (group.label.trim()) {
      hints.add(group.label);
    }
  }

  const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
  const edges = Array.isArray(graph.edges) ? graph.edges : [];
  const linkedNodeIds = new Set<string>();
  for (const edge of edges) {
    if (edge.sourceId === node.id) {
      linkedNodeIds.add(edge.targetId);
    }
    if (edge.targetId === node.id) {
      linkedNodeIds.add(edge.sourceId);
    }
  }

  for (const runtimeNode of nodes) {
    if (runtimeNode.kind !== "runtime") continue;
    if (!linkedNodeIds.has(runtimeNode.id)) continue;

    hints.add(runtimeNode.label);
    const runtimes = runtimeNode.metadata.runtimes;
    if (Array.isArray(runtimes)) {
      for (const runtime of runtimes) {
        if (typeof runtime === "string" && runtime.trim()) {
          hints.add(runtime);
        }
      }
    }
  }

  return [...hints];
}

export function resolveNodeLabels(
  graph: SoftwareGraph,
  nodeIds: string[],
  limit = 24,
): { labels: string[]; omittedCount: number } {
  const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
  const nodeById = new Map(nodes.map((entry) => [entry.id, entry]));
  const labels = nodeIds.map((nodeId) => nodeById.get(nodeId)?.label ?? nodeId).slice(0, limit);
  return { labels, omittedCount: Math.max(0, nodeIds.length - limit) };
}
