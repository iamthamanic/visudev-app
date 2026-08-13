/**
 * Shared interactive graph canvas for Blueprint Infrastructure.
 * Cytoscape lazy-loads in separate chunks (~444kB + 46kB, ~158kB gzip total);
 * only fetched when the Infrastructure tab renders.
 */
import styles from "./GraphCanvas.module.css";
import { GraphToolbar } from "./graph-canvas/_toolbar.tsx";
import { useCytoscapeGraphLifecycle } from "./graph-canvas/useCytoscapeGraphLifecycle.js";
import { useGraphCanvasToolbar } from "./graph-canvas/useGraphCanvasToolbar.js";
import { useValidatedGraphElements } from "./graph-canvas/useValidatedGraphElements.js";
import type { LayoutPreset } from "./graph-canvas/_layout.js";
import type { GraphCanvasEdge, GraphCanvasNode } from "./graph-canvas/types.js";

export type { GraphCanvasEdge, GraphCanvasNode };

export interface GraphCanvasProps {
  nodes: GraphCanvasNode[];
  edges: GraphCanvasEdge[];
  layoutPreset?: LayoutPreset;
  onEdgeSelect?: (edgeId: string | null) => void;
  onNodeSelect?: (nodeId: string | null) => void;
  selectedNodeId?: string | null;
  highlightedNodeIds?: readonly string[];
}

export function GraphCanvas({
  nodes,
  edges,
  layoutPreset = "default",
  onEdgeSelect,
  onNodeSelect,
  selectedNodeId,
  highlightedNodeIds,
}: GraphCanvasProps) {
  const validated = useValidatedGraphElements(nodes, edges);
  const { setContainerRef, hasGraph, initError, graphRef } = useCytoscapeGraphLifecycle(
    validated,
    layoutPreset,
    onEdgeSelect,
    onNodeSelect,
    selectedNodeId,
    highlightedNodeIds,
  );
  const { handleFit, handleZoomIn, handleZoomOut } = useGraphCanvasToolbar(graphRef);

  return (
    <div className={styles.root}>
      {validated.isLargeGraph && hasGraph && !initError ? (
        <p className={styles.largeGraphHint} role="status">
          Großer Graph — vereinfachtes Layout. Zoome für Details.
        </p>
      ) : null}
      <div
        ref={setContainerRef}
        className={`${styles.canvas} ${hasGraph && !initError ? "" : styles.canvasHidden}`}
        aria-hidden={!hasGraph || Boolean(initError)}
      />
      {!hasGraph ? (
        <div className={styles.emptyOverlay}>
          <p className={styles.emptyText}>Keine Graph-Daten vorhanden.</p>
        </div>
      ) : initError ? (
        <div className={styles.emptyOverlay}>
          <p className={styles.emptyText}>{initError}</p>
        </div>
      ) : (
        <GraphToolbar onZoomIn={handleZoomIn} onZoomOut={handleZoomOut} onFit={handleFit} />
      )}
    </div>
  );
}
