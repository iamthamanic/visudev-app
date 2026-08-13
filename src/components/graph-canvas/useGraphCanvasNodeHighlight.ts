/**
 * Applies Cytoscape `selected` class when GraphCanvas receives selectedNodeId.
 */

import { useEffect, type RefObject } from "react";
import type cytoscape from "cytoscape";

const EMPTY_IDS: readonly string[] = [];

export function useGraphCanvasNodeHighlight(
  graphRef: RefObject<cytoscape.Core | null>,
  hasGraph: boolean,
  selectedNodeId: string | null | undefined,
  validNodeIds: Set<string>,
  highlightedNodeIds?: readonly string[],
): void {
  const extraIds = highlightedNodeIds ?? EMPTY_IDS;
  useEffect(() => {
    const graph = graphRef.current;
    if (!graph || !hasGraph) return;

    graph.nodes().removeClass("selected");

    const ids = new Set(extraIds);
    if (selectedNodeId) ids.add(selectedNodeId);

    for (const id of ids) {
      if (!validNodeIds.has(id)) continue;
      const node = graph.getElementById(id);
      if (node.nonempty()) {
        node.addClass("selected");
      }
    }
  }, [graphRef, hasGraph, selectedNodeId, validNodeIds, extraIds]);
}
