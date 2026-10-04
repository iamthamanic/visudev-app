/**
 * Evidence helpers for Infrastructure inspector (PR-15).
 * Location: src/modules/blueprint/components/infrastructure/infrastructure-evidence.ts
 */

import type { SoftwareGraph, SoftwareGraphEvidence, SoftwareGraphNode } from "../../types";

export function evidenceForInfrastructureNode(
  graph: SoftwareGraph | null | undefined,
  node: SoftwareGraphNode | null | undefined,
): SoftwareGraphEvidence[] {
  if (!graph || !node) return [];
  const evidence = Array.isArray(graph.evidence) ? graph.evidence : [];
  return evidence.filter((item) => {
    if (item.nodeId === node.id) return true;
    if (node.filePath && item.filePath === node.filePath) {
      if (node.line == null) return true;
      return item.line === node.line;
    }
    return false;
  });
}

/** Structural evidence when graph.evidence is empty but node carries a file path / source. */
export function structuralEvidenceLabels(node: SoftwareGraphNode | null | undefined): string[] {
  if (!node) return [];
  const labels: string[] = [];
  if (typeof node.filePath === "string" && node.filePath.trim()) {
    labels.push(node.line != null ? `${node.filePath}:${node.line}` : node.filePath);
  }
  const source = node.metadata?.source;
  if (typeof source === "string" && source.trim()) {
    labels.push(`Quelle: ${source}`);
  }
  return labels;
}
