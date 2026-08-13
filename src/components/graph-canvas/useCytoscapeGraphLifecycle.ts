import type { ValidatedGraphCanvasInput } from "./_validate.js";
import { useCytoscapeGraphMount } from "./useCytoscapeGraphMount.js";
import { useGraphCanvasEdgeSelection } from "./useGraphCanvasEdgeSelection.js";
import { useGraphCanvasNodeHighlight } from "./useGraphCanvasNodeHighlight.js";
import { useGraphCanvasNodeSelection } from "./useGraphCanvasNodeSelection.js";
import { useCytoscapeGraphSync } from "./useCytoscapeGraphSync.js";
import type { LayoutPreset } from "./_layout.js";

export function useCytoscapeGraphLifecycle(
  validated: ValidatedGraphCanvasInput,
  layoutPreset: LayoutPreset = "default",
  onEdgeSelect?: (edgeId: string | null) => void,
  onNodeSelect?: (nodeId: string | null) => void,
  selectedNodeId?: string | null,
  highlightedNodeIds?: readonly string[],
) {
  const { setContainerRef, hasGraph, initError, graphRef } = useCytoscapeGraphMount(
    validated,
    layoutPreset,
  );
  const validNodeIds = new Set(validated.nodes.map((node) => node.id));
  useCytoscapeGraphSync(graphRef, validated, hasGraph, layoutPreset);
  useGraphCanvasEdgeSelection(graphRef, hasGraph, onEdgeSelect);
  useGraphCanvasNodeSelection(graphRef, hasGraph, onNodeSelect);
  useGraphCanvasNodeHighlight(graphRef, hasGraph, selectedNodeId, validNodeIds, highlightedNodeIds);
  return { setContainerRef, hasGraph, initError, graphRef };
}
