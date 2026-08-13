/**
 * AtlasView — birds-eye 2D clustered map or optional lazy-loaded 3D city of the SoftwareGraph.
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
import { useAtlasViewState } from "./atlas/useAtlasViewState.js";
import { TruncationBanner } from "../../../components/ui/TruncationBanner.js";
import styles from "../styles/AtlasView.module.css";

const GraphCanvas = lazy(() =>
  import("../../../components/GraphCanvas").then((module) => ({ default: module.GraphCanvas })),
);

const AtlasCityScene = lazy(() =>
  import("./atlas/AtlasCityScene.js").then((module) => ({ default: module.AtlasCityScene })),
);

interface AtlasViewProps {
  blueprint: BlueprintData;
}

export function AtlasView({ blueprint }: AtlasViewProps) {
  const graph = blueprint.graph;
  const state = useAtlasViewState(graph);

  if (!graph) {
    return (
      <div className={styles.empty}>
        <p className={styles.emptyTitle}>Keine Atlas-Daten</p>
        <p className={styles.emptyHint}>
          Starte eine Blueprint-Analyse, um die Systemübersicht als 2D-Karte zu sehen.
        </p>
      </div>
    );
  }

  const hasVisibleNodes = state.projection.nodes.length > 0;
  const atlasStats = computeAtlasStats(graph, blueprint.filesAnalyzed ?? 0);
  const totalFiles = blueprint.totalFiles ?? null;
  const filesAnalyzed = blueprint.filesAnalyzed ?? 0;
  const isPartialScan =
    graph.condensed === true ||
    (totalFiles != null && filesAnalyzed > 0 && filesAnalyzed < totalFiles);

  const canvasContent = !hasVisibleNodes ? (
    <div className={styles.filteredCanvasEmpty}>
      <p>Keine Knoten für die aktuelle Suche. Passe den Suchbegriff an.</p>
    </div>
  ) : state.viewMode === "3d" ? (
    <Suspense fallback={<p className={styles.loading}>3D-Stadt wird geladen...</p>}>
      <AtlasCityScene
        blocks={state.cityBlocks}
        selectedNodeId={state.selectedNodeId}
        onSelectNode={state.handleSelectNode}
      />
    </Suspense>
  ) : (
    <Suspense fallback={<p className={styles.loading}>Atlas wird geladen...</p>}>
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
        <AtlasInspector graph={graph} node={state.selectedNode} cluster={state.selectedCluster} />
      }
    />
  );
}
