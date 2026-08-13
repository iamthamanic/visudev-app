/**
 * Composes dependencies graph canvas with toolbar, minimap, orphan group, and footer stats.
 */

import { lazy, Suspense, type RefObject } from "react";
import type { GraphCanvasEdge, GraphCanvasNode } from "../../types";
import { DependenciesGraphFooter } from "./DependenciesGraphFooter.js";
import { DependenciesGraphToolbar } from "./DependenciesGraphToolbar.js";
import { DependenciesMinimap } from "./DependenciesMinimap.js";
import { useDependenciesFullscreen } from "./useDependenciesFullscreen.js";
import styles from "../../styles/DependenciesView.module.css";

const GraphCanvas = lazy(() =>
  import("../../../../components/GraphCanvas").then((module) => ({ default: module.GraphCanvas })),
);

export interface DependenciesGraphCanvasProps {
  nodes: GraphCanvasNode[];
  edges: GraphCanvasEdge[];
  totalNodes: number;
  totalEdges: number;
  orphanCount: number;
  orphanNodeIds: string[];
  selectedNodeId: string | null;
  highlightedNodeIds?: readonly string[];
  searchQuery: string;
  searchInputRef: RefObject<HTMLInputElement>;
  onSearchChange: (value: string) => void;
  onResetSearch: () => void;
  onNodeSelect: (nodeId: string | null) => void;
  onEdgeSelect: (edgeId: string | null) => void;
  onMinimapSelect: (nodeId: string) => void;
}

export function DependenciesGraphCanvas({
  nodes,
  edges,
  totalNodes,
  totalEdges,
  orphanCount,
  orphanNodeIds,
  selectedNodeId,
  highlightedNodeIds,
  searchQuery,
  searchInputRef,
  onSearchChange,
  onResetSearch,
  onNodeSelect,
  onEdgeSelect,
  onMinimapSelect,
}: DependenciesGraphCanvasProps): JSX.Element {
  const { shellRef, isFullscreen, toggleFullscreen } = useDependenciesFullscreen();

  return (
    <div
      ref={shellRef}
      className={`${styles.graphShell} ${isFullscreen ? styles.graphShellFullscreen : ""}`}
      data-deps-canvas="true"
    >
      <DependenciesGraphToolbar
        searchQuery={searchQuery}
        searchInputRef={searchInputRef}
        isFullscreen={isFullscreen}
        onSearchChange={onSearchChange}
        onResetSearch={onResetSearch}
        onToggleFullscreen={() => void toggleFullscreen()}
      />

      <div className={styles.graphBody}>
        <Suspense fallback={<p className={styles.loading}>Graph wird geladen...</p>}>
          <GraphCanvas
            nodes={nodes}
            edges={edges}
            layoutPreset="force"
            selectedNodeId={selectedNodeId}
            highlightedNodeIds={highlightedNodeIds}
            onNodeSelect={onNodeSelect}
            onEdgeSelect={onEdgeSelect}
          />
        </Suspense>
        <ul className={styles.edgeLabels} aria-label="Kantenbeschriftungen">
          {edges.slice(0, 24).map((edge) => (
            <li key={edge.id} data-testid="edge-label">
              {edge.label ?? edge.kind}
            </li>
          ))}
        </ul>
        <DependenciesMinimap
          nodes={nodes}
          orphanNodeIds={orphanNodeIds}
          onSelectNode={onMinimapSelect}
        />
        {orphanCount > 0 ? (
          <p className={styles.orphanGroup} data-testid="dep-orphan-group">
            Ohne Verbindungen ({orphanCount})
          </p>
        ) : null}
      </div>

      <DependenciesGraphFooter
        visibleNodes={nodes.length}
        totalNodes={totalNodes}
        visibleEdges={edges.length}
        totalEdges={totalEdges}
      />
    </div>
  );
}
