/**
 * DependenciesView — cross-module imports, calls, API, events, and data edges.
 */

import { useEffect, useMemo, useState } from "react";
import type { BlueprintData } from "../types";
import { BlueprintViewLayout } from "./ui/BlueprintViewLayout.js";
import { DependenciesControls } from "./dependencies/DependenciesControls.js";
import { DependenciesGraphCanvas } from "./dependencies/DependenciesGraphCanvas.js";
import { DependenciesInspector } from "./dependencies/DependenciesInspector.js";
import {
  DEFAULT_VISIBLE_DEPENDENCY_KINDS,
  applyOrphanFilter,
  buildDependenciesGraphIndex,
  countDependencyEdgesByKind,
  filterDependenciesProjection,
  findCentralDependencyNodeId,
  getEdgeEvidenceFromIndex,
  getNodeDependencySummaryFromIndex,
  projectDependenciesGraph,
  type DependencyEdgeKind,
} from "./dependencies/_projection.js";
import { useDependenciesSearch } from "./dependencies/useDependenciesSearch.js";
import styles from "../styles/DependenciesView.module.css";

interface DependenciesViewProps {
  blueprint: BlueprintData;
}

export function DependenciesView({ blueprint }: DependenciesViewProps) {
  const graph = blueprint.graph;
  const { searchQuery, searchInputRef, setSearchQuery, resetSearch } = useDependenciesSearch();
  const [visibleEdgeKinds, setVisibleEdgeKinds] = useState<Set<DependencyEdgeKind>>(
    () => new Set(DEFAULT_VISIBLE_DEPENDENCY_KINDS),
  );
  const [showOrphans, setShowOrphans] = useState(true);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  const baseProjection = useMemo(() => {
    if (!graph) return { nodes: [], edges: [], orphanNodeIds: [] };
    return projectDependenciesGraph(graph, { visibleEdgeKinds });
  }, [graph, visibleEdgeKinds]);

  const searchedProjection = useMemo(
    () =>
      graph ? filterDependenciesProjection(baseProjection, searchQuery, graph) : baseProjection,
    [baseProjection, searchQuery, graph],
  );

  const projection = useMemo(
    () => applyOrphanFilter(searchedProjection, showOrphans),
    [searchedProjection, showOrphans],
  );

  const graphIndex = useMemo(() => {
    if (!graph) return null;
    return buildDependenciesGraphIndex(graph);
  }, [graph]);

  const topDependencies = useMemo(() => {
    if (!graph) return [];
    return countDependencyEdgesByKind(graph);
  }, [graph]);

  const selectedNode = useMemo(() => {
    if (!selectedNodeId || !graphIndex) return null;
    return graphIndex.nodeById.get(selectedNodeId) ?? null;
  }, [graphIndex, selectedNodeId]);

  const selection = useMemo(() => {
    if (!graphIndex) return null;
    return getEdgeEvidenceFromIndex(graphIndex, selectedEdgeId);
  }, [graphIndex, selectedEdgeId]);

  const nodeSummary = useMemo(() => {
    if (!selectedNodeId || !graphIndex) return null;
    return getNodeDependencySummaryFromIndex(graphIndex, selectedNodeId);
  }, [graphIndex, selectedNodeId]);

  useEffect(() => {
    if (!graph) return;

    const visibleNodeIds = new Set(projection.nodes.map((node) => node.id));

    if (selectedNodeId) {
      if (!visibleNodeIds.has(selectedNodeId)) {
        setSelectedNodeId(null);
      }
      return;
    }

    if (visibleNodeIds.size === 0) return;

    const centralId = findCentralDependencyNodeId(graph, { visibleEdgeKinds });
    if (!centralId || !visibleNodeIds.has(centralId)) return;
    setSelectedNodeId(centralId);
  }, [graph, projection.nodes, selectedNodeId, visibleEdgeKinds]);

  useEffect(() => {
    if (!selectedEdgeId) return;
    const visibleEdgeIds = new Set(projection.edges.map((edge) => edge.id));
    if (!visibleEdgeIds.has(selectedEdgeId)) {
      setSelectedEdgeId(null);
    }
  }, [projection.edges, selectedEdgeId]);

  const toggleEdgeKind = (kind: DependencyEdgeKind) => {
    setVisibleEdgeKinds((current) => {
      const next = new Set(current);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
    setSelectedEdgeId(null);
  };

  const resetFilters = () => {
    setVisibleEdgeKinds(new Set(DEFAULT_VISIBLE_DEPENDENCY_KINDS));
    setShowOrphans(true);
    setSelectedEdgeId(null);
    resetSearch();
  };

  if (!graph) {
    return (
      <div className={styles.empty}>
        <p className={styles.emptyTitle}>Keine Abhängigkeits-Daten</p>
        <p className={styles.emptyHint}>
          Starte eine neue Blueprint-Analyse, um Import-, Call-, API-, Event- und Data-Kanten zu
          sehen.
        </p>
      </div>
    );
  }

  const hasVisibleGraph = projection.nodes.length > 0;

  const handleMinimapSelect = (nodeId: string) => {
    setSelectedNodeId(nodeId);
    setSelectedEdgeId(null);
    const graphNode = graph.nodes.find((candidate) => candidate.id === nodeId);
    if (!graphNode) return;
    setSearchQuery(graphNode.label);
    searchInputRef.current?.focus();
  };

  const handleNodeSelect = (nodeId: string | null) => {
    setSelectedNodeId(nodeId);
    if (nodeId) setSelectedEdgeId(null);
  };

  const handleEdgeSelect = (edgeId: string | null) => {
    setSelectedEdgeId(edgeId);
    if (edgeId) setSelectedNodeId(null);
  };

  return (
    <BlueprintViewLayout
      controls={
        <DependenciesControls
          visibleEdgeKinds={visibleEdgeKinds}
          topDependencies={topDependencies}
          showOrphans={showOrphans}
          orphanCount={searchedProjection.orphanNodeIds.length}
          onToggleEdgeKind={toggleEdgeKind}
          onToggleOrphans={() => setShowOrphans((current) => !current)}
          onResetFilters={resetFilters}
        />
      }
      canvas={
        <div className={styles.canvasWrap}>
          {hasVisibleGraph ? (
            <DependenciesGraphCanvas
              nodes={projection.nodes}
              edges={projection.edges}
              totalNodes={baseProjection.nodes.length}
              totalEdges={baseProjection.edges.length}
              orphanCount={projection.orphanNodeIds.length}
              orphanNodeIds={projection.orphanNodeIds}
              selectedNodeId={selectedNodeId}
              searchQuery={searchQuery}
              searchInputRef={searchInputRef}
              onSearchChange={setSearchQuery}
              onResetSearch={resetSearch}
              onNodeSelect={handleNodeSelect}
              onEdgeSelect={handleEdgeSelect}
              onMinimapSelect={handleMinimapSelect}
            />
          ) : (
            <div className={styles.filteredCanvasEmpty}>
              <p>
                {searchQuery
                  ? "Keine Module für die aktuelle Suche. Passe den Suchbegriff an."
                  : "Passe die Beziehungstypen an, um Abhängigkeiten anzuzeigen."}
              </p>
            </div>
          )}
        </div>
      }
      inspector={
        <DependenciesInspector
          graph={graph}
          nodeById={graphIndex?.nodeById ?? new Map()}
          topDependencies={topDependencies}
          selectedNode={selectedNode}
          selectedEdge={selection?.edge ?? null}
          selectedEvidence={selection?.evidence ?? []}
          incomingCount={nodeSummary?.incoming ?? 0}
          outgoingCount={nodeSummary?.outgoing ?? 0}
          topNodeDependencies={nodeSummary?.neighbors ?? []}
        />
      }
    />
  );
}
