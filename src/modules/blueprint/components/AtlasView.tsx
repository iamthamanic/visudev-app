/**
 * AtlasView — 2D Product-Understanding product-domain map (PU-07).
 * Primary layer: application / product-area / capability. 3D city is not a required path.
 */

import { lazy, Suspense } from "react";
import type { BlueprintData } from "../types";
import { BlueprintViewLayout } from "./ui/BlueprintViewLayout.js";
import { AtlasClusterLabels } from "./atlas/AtlasClusterLabels.js";
import { AtlasControls } from "./atlas/AtlasControls.js";
import { AtlasInspector } from "./atlas/AtlasInspector.js";
import { AtlasLegend } from "./atlas/AtlasLegend.js";
import { computeAtlasStats } from "./atlas/atlas-stats.js";
import { AtlasStatsBar } from "./atlas/AtlasStatsBar.js";
import { AtlasZoomControls } from "./atlas/AtlasZoomControls.js";
import { AtlasTreemap } from "./atlas/AtlasTreemap.js";
import { useAtlasViewState } from "./atlas/useAtlasViewState.js";
import { TruncationBanner } from "../../../components/ui/TruncationBanner.js";
import { BlueprintViewStateGate } from "./ui/BlueprintViewStateGate.js";
import type { BlueprintViewScanProps } from "../blueprint-view-state.js";
import styles from "../styles/AtlasView.module.css";

const GraphCanvas = lazy(() =>
  import("../../../components/GraphCanvas").then((module) => ({ default: module.GraphCanvas })),
);

interface AtlasViewProps extends BlueprintViewScanProps {
  blueprint: BlueprintData;
}

export function AtlasView({ blueprint, scanStatus, scanError, onRetry }: AtlasViewProps) {
  const graph = blueprint.graph;
  const state = useAtlasViewState(graph);

  if (!graph) {
    return (
      <BlueprintViewStateGate
        viewId="atlas"
        hasViewData={false}
        scanStatus={scanStatus}
        scanError={scanError}
        onRetry={onRetry}
      >
        {null}
      </BlueprintViewStateGate>
    );
  }

  const hasVisibleNodes = state.projection.nodes.length > 0;
  const atlasStats = computeAtlasStats(graph, blueprint.filesAnalyzed ?? 0);
  const totalFiles = blueprint.totalFiles ?? null;
  const filesAnalyzed = blueprint.filesAnalyzed ?? 0;
  const isPartialScan =
    graph.condensed === true ||
    (totalFiles != null && filesAnalyzed > 0 && filesAnalyzed < totalFiles) ||
    (blueprint.truncation as { truncated?: boolean } | undefined)?.truncated === true;

  const canvasContent = !hasVisibleNodes ? (
    <div className={styles.filteredCanvasEmpty} data-testid="atlas-product-map-empty">
      <p>
        Noch keine Produktbereiche oder Fähigkeiten aus den Scan-Signalen ableitbar. Technische
        Artefakte erscheinen im Inspektor, sobald Konzepte verfügbar sind.
      </p>
    </div>
  ) : (
    <Suspense fallback={<p className={styles.loading}>Produktlandkarte wird geladen...</p>}>
      <GraphCanvas
        nodes={state.projection.nodes}
        edges={state.projection.edges}
        layoutPreset="force"
      />
    </Suspense>
  );

  return (
    <BlueprintViewLayout
      controls={
        <AtlasControls
          searchQuery={state.searchQuery}
          totalNodes={state.projection.totalNodes}
          visibleNodes={state.projection.visibleNodes}
          condensed={state.projection.condensed}
          viewMode={state.viewMode}
          threeDisabled={state.threeDisabled}
          nodes={state.projection.nodes}
          groups={state.visibleGroups}
          selectedNodeId={state.selectedNodeId}
          selectedGroupId={state.selectedGroupId}
          onSearchChange={state.setSearchQuery}
          onResetSearch={state.resetSearch}
          onSelectNode={state.handleSelectNode}
          onSelectGroup={state.handleSelectGroup}
          onSelectViewMode={state.handleSelectViewMode}
        />
      }
      canvas={
        <div className={styles.canvasWrap}>
          {isPartialScan ? <TruncationBanner analyzed={filesAnalyzed} total={totalFiles} /> : null}
          <AtlasStatsBar stats={atlasStats} />
          <div className={styles.canvasMain}>{canvasContent}</div>
          <div className={styles.treemapSlot}>
            <AtlasTreemap graph={graph} />
          </div>
          <AtlasClusterLabels
            groups={state.visibleGroups}
            selectedGroupId={state.selectedGroupId}
            onSelectGroup={state.handleSelectGroup}
            coveragePercent={atlasStats.coveragePercent}
          />
          <AtlasLegend />
          <AtlasZoomControls />
        </div>
      }
      inspector={
        <AtlasInspector
          graph={graph}
          semanticEntity={state.selectedSemanticEntity}
          node={state.selectedNode}
          cluster={state.selectedCluster}
        />
      }
    />
  );
}
