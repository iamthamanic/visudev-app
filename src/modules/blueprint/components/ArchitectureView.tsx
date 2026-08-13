import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import type { BlueprintData, SoftwareGraphNodeKind } from "../types";
import { BlueprintViewLayout } from "./ui/BlueprintViewLayout.js";
import { applyArchitectureNodeColors } from "./architecture/_apply-colors.js";
import { ArchitectureControls } from "./architecture/ArchitectureControls.js";
import { ArchitectureDomainGroups } from "./architecture/ArchitectureDomainGroups.js";
import { ArchitectureGroupingToggle } from "./architecture/ArchitectureGroupingToggle.js";
import { ArchitectureInspector } from "./architecture/ArchitectureInspector.js";
import { ArchitectureLayerStack } from "./architecture/ArchitectureLayerStack.js";
import {
  GROUPING_STACK_KIND,
  GROUPING_VISIBLE_KINDS,
  type ArchitectureGroupingMode,
} from "./architecture/architecture-grouping.js";
import {
  buildArchitectureStackCards,
  groupArchitectureCardsByDomain,
} from "./architecture/build-layer-stack.js";
import { projectArchitectureGraph } from "./architecture/_projection.js";
import {
  collectFileDomainSources,
  domainSourceHintText,
} from "./architecture/domain-source-hint.js";
import { useArchitectureDefaultLayerSelection } from "../hooks/useArchitectureDefaultLayerSelection.js";
import { buildGraphSnapshotKey } from "../services/graph-snapshot-key.js";
import { BlueprintViewStateGate } from "./ui/BlueprintViewStateGate.js";
import type { BlueprintViewScanProps } from "../blueprint-view-state.js";
import styles from "../styles/ArchitectureView.module.css";

const GraphCanvas = lazy(() =>
  import("../../../components/GraphCanvas").then((module) => ({ default: module.GraphCanvas })),
);

interface ArchitectureViewProps extends BlueprintViewScanProps {
  blueprint: BlueprintData;
}

export function ArchitectureView({
  blueprint,
  scanStatus,
  scanError,
  onRetry,
}: ArchitectureViewProps) {
  const graph = blueprint.graph;
  const [groupingMode, setGroupingMode] = useState<ArchitectureGroupingMode>("layers");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(() => new Set());
  const [visibleKinds, setVisibleKinds] = useState<Set<SoftwareGraphNodeKind>>(
    () => new Set(GROUPING_VISIBLE_KINDS.layers),
  );

  const graphSnapshotKey = buildGraphSnapshotKey(graph);

  useEffect(() => {
    setVisibleKinds(new Set(GROUPING_VISIBLE_KINDS[groupingMode]));
    if (groupingMode !== "layers") {
      setSelectedNodeId(null);
    }
  }, [groupingMode]);

  useArchitectureDefaultLayerSelection(graph, groupingMode, setSelectedNodeId, graphSnapshotKey);

  const architectureProjection = useMemo(() => {
    if (!graph) {
      return { nodes: [], edges: [], collapsible: [] };
    }
    const projectedArchitecture = projectArchitectureGraph(graph, { collapsedIds, visibleKinds });
    return {
      ...projectedArchitecture,
      nodes: applyArchitectureNodeColors(projectedArchitecture.nodes),
    };
  }, [graph, collapsedIds, visibleKinds]);

  const stackCards = useMemo(() => {
    if (!graph) return [];
    return buildArchitectureStackCards(graph, GROUPING_STACK_KIND[groupingMode]);
  }, [graph, groupingMode]);

  const domainGroups = useMemo(() => {
    if (!graph || groupingMode !== "layers") return [];
    return groupArchitectureCardsByDomain(graph, stackCards);
  }, [graph, groupingMode, stackCards]);

  const domainHint = useMemo(() => {
    if (!graph) return null;
    return domainSourceHintText(collectFileDomainSources(graph.nodes));
  }, [graph]);

  const selectedNode = useMemo(() => {
    if (!graph || !selectedNodeId) return null;
    return graph.nodes.find((node) => node.id === selectedNodeId) ?? null;
  }, [graph, selectedNodeId]);

  const toggleCollapse = (id: string) => {
    setCollapsedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleKind = (kind: SoftwareGraphNodeKind) => {
    setVisibleKinds((current) => {
      const next = new Set(current);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  };

  const resetFilters = () => {
    setCollapsedIds(new Set());
    setVisibleKinds(new Set(GROUPING_VISIBLE_KINDS[groupingMode]));
  };

  if (!graph) {
    return (
      <BlueprintViewStateGate
        viewId="architecture"
        hasViewData={false}
        scanStatus={scanStatus}
        scanError={scanError}
        onRetry={onRetry}
      >
        {null}
      </BlueprintViewStateGate>
    );
  }

  const hasVisibleNodes = architectureProjection.nodes.length > 0;
  const showStackInCanvas = groupingMode !== "modules";

  const controls = (
    <div className={styles.controlsColumn}>
      {!showStackInCanvas ? (
        <ArchitectureLayerStack
          cards={stackCards}
          selectedNodeId={selectedNodeId}
          onSelectNode={setSelectedNodeId}
        />
      ) : null}
      <ArchitectureControls
        collapsible={architectureProjection.collapsible}
        collapsedIds={collapsedIds}
        visibleKinds={visibleKinds}
        hasVisibleNodes={hasVisibleNodes}
        onToggleCollapse={toggleCollapse}
        onToggleKind={toggleKind}
        onResetFilters={resetFilters}
      />
    </div>
  );

  const canvas = showStackInCanvas ? (
    <div className={styles.stackCanvasWrap}>
      {groupingMode === "layers" ? (
        <ArchitectureDomainGroups
          groups={domainGroups}
          selectedNodeId={selectedNodeId}
          onSelectNode={setSelectedNodeId}
        />
      ) : (
        <ArchitectureLayerStack
          cards={stackCards}
          selectedNodeId={selectedNodeId}
          onSelectNode={setSelectedNodeId}
          variant="canvas"
          showTitle={false}
        />
      )}
    </div>
  ) : (
    <div className={styles.canvasWrap}>
      {hasVisibleNodes ? (
        <Suspense fallback={<p className={styles.loading}>Graph wird geladen...</p>}>
          <GraphCanvas
            nodes={architectureProjection.nodes}
            edges={architectureProjection.edges}
            layoutPreset="hierarchical"
          />
        </Suspense>
      ) : (
        <div className={styles.filteredCanvasEmpty}>
          <p>Passe Filter oder Einklapp-Zustand an, um Knoten anzuzeigen.</p>
        </div>
      )}
    </div>
  );

  return (
    <div className={styles.root}>
      <ArchitectureGroupingToggle mode={groupingMode} onSelectMode={setGroupingMode} />
      {domainHint ? (
        <p className={styles.domainSourceHint} role="status">
          {domainHint}
        </p>
      ) : null}

      <BlueprintViewLayout
        controls={controls}
        canvas={canvas}
        inspector={<ArchitectureInspector graph={graph} node={selectedNode} />}
      />
    </div>
  );
}
