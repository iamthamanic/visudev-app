/**
 * DependenciesView — change-impact map by default (PU-09).
 * Technical import/call topology remains Technik/Dateien drill-down.
 * Location: src/modules/blueprint/components/DependenciesView.tsx
 */

import { useEffect, useMemo, useState } from "react";
import type { BlueprintData } from "../types";
import { BlueprintViewLayout } from "./ui/BlueprintViewLayout.js";
import { DependenciesControls } from "./dependencies/DependenciesControls.js";
import { DependenciesGraphCanvas } from "./dependencies/DependenciesGraphCanvas.js";
import { DependenciesImpactInspector } from "./dependencies/DependenciesImpactInspector.js";
import { DependenciesInspector } from "./dependencies/DependenciesInspector.js";
import {
  DependenciesLayerNav,
  type DependenciesLayer,
} from "./dependencies/DependenciesLayerNav.js";
import {
  DependenciesOverlayToggles,
  type DependencyOverlayId,
} from "./dependencies/DependenciesOverlayToggles.js";
import { mergeVisibleKindsWithOverlays } from "./dependencies/dependencies-overlay.js";
import {
  DEFAULT_VISIBLE_DEPENDENCY_KINDS,
  applyOrphanFilter,
  buildDependenciesGraphIndex,
  countDependencyEdgesByKind,
  filterDependenciesProjection,
  getEdgeEvidenceFromIndex,
  getNodeDependencySummaryFromIndex,
  type DependencyEdgeKind,
} from "./dependencies/_projection.js";
import { buildSemanticSystemModel } from "../../../../shared/semantic-system-model.js";
import type { SoftwareGraphNode } from "../types";
import {
  projectDependenciesSemanticGraph,
  resolveSemanticRepresentativeNode,
} from "./dependencies/project-dependencies-semantic.js";
import { resolveDependenciesImpactProjection } from "./dependencies/resolve-dependencies-product-model.js";
import { useDependenciesSearch } from "./dependencies/useDependenciesSearch.js";
import { BlueprintViewStateGate } from "./ui/BlueprintViewStateGate.js";
import type { BlueprintViewScanProps } from "../blueprint-view-state.js";
import { TruncationBanner } from "../../../components/ui/TruncationBanner.js";
import { selectionFromNode } from "../selection.js";
import { ProductConceptMissingInView } from "../../../components/ui/ProductConceptMissingInView.js";
import { useBlueprintProductSelection } from "../context/useBlueprintProductSelection.js";
import { resolveCrossViewFocus } from "../../../../shared/product-understanding/cross-view-selection.js";
import { isProductConceptSelectionId } from "../../../../shared/product-understanding/selection.js";
import styles from "../styles/DependenciesView.module.css";

interface DependenciesViewProps extends BlueprintViewScanProps {
  blueprint: BlueprintData;
}

export function DependenciesView({
  blueprint,
  scanStatus,
  scanError,
  onRetry,
}: DependenciesViewProps) {
  const graph = blueprint.graph;
  const { selection: productSelection, setSelection } = useBlueprintProductSelection();
  const { searchQuery, searchInputRef, setSearchQuery, resetSearch } = useDependenciesSearch();
  const [layer, setLayer] = useState<DependenciesLayer>("impact");
  const [focusConceptId, setFocusConceptId] = useState<string | null>(null);
  const [visibleEdgeKinds, setVisibleEdgeKinds] = useState<Set<DependencyEdgeKind>>(
    () => new Set(DEFAULT_VISIBLE_DEPENDENCY_KINDS),
  );
  const [activeOverlays, setActiveOverlays] = useState<Set<DependencyOverlayId>>(() => new Set());
  const [showOrphans, setShowOrphans] = useState(true);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [focusSemanticEntityId, setFocusSemanticEntityId] = useState<string | null>(null);

  const effectiveEdgeKinds = useMemo(
    () => mergeVisibleKindsWithOverlays(visibleEdgeKinds, activeOverlays),
    [activeOverlays, visibleEdgeKinds],
  );

  const semanticModel = useMemo(() => {
    if (!graph) return null;
    return buildSemanticSystemModel(graph);
  }, [graph]);

  const impactProjection = useMemo(
    () =>
      resolveDependenciesImpactProjection(blueprint, graph, {
        focusConceptId: layer === "impact" ? focusConceptId : null,
        searchQuery: layer === "impact" ? searchQuery : undefined,
      }),
    [blueprint, focusConceptId, graph, layer, searchQuery],
  );

  const impactConceptIds = useMemo(() => {
    const full = resolveDependenciesImpactProjection(blueprint, graph, {
      focusConceptId: null,
      searchQuery: undefined,
    });
    return full?.nodes.map((node) => node.id) ?? [];
  }, [blueprint, graph]);

  const dependenciesFocus = useMemo(
    () =>
      productSelection
        ? resolveCrossViewFocus(productSelection, "dependencies", impactConceptIds)
        : null,
    [impactConceptIds, productSelection],
  );

  useEffect(() => {
    if (!dependenciesFocus?.presentInView || !dependenciesFocus.viewLocalId) return;
    if (layer !== "impact") setLayer("impact");
    setFocusConceptId(dependenciesFocus.viewLocalId);
    setSelectedNodeId(dependenciesFocus.viewLocalId);
  }, [dependenciesFocus, layer]);

  const techBaseProjection = useMemo(() => {
    if (!graph || layer === "impact") return { nodes: [], edges: [], orphanNodeIds: [] };
    return projectDependenciesSemanticGraph(graph, {
      visibleEdgeKinds: effectiveEdgeKinds,
      level: layer === "files" ? "files" : "semantic",
      focusSemanticEntityId,
      semanticModel,
    });
  }, [effectiveEdgeKinds, focusSemanticEntityId, graph, layer, semanticModel]);

  const searchedTechProjection = useMemo(
    () =>
      graph && layer !== "impact"
        ? filterDependenciesProjection(techBaseProjection, searchQuery, graph)
        : techBaseProjection,
    [graph, layer, searchQuery, techBaseProjection],
  );

  const techProjection = useMemo(
    () => applyOrphanFilter(searchedTechProjection, showOrphans),
    [searchedTechProjection, showOrphans],
  );

  const projection =
    layer === "impact"
      ? {
          nodes: impactProjection?.nodes ?? [],
          edges: impactProjection?.edges ?? [],
          orphanNodeIds: [] as string[],
        }
      : techProjection;

  const baseProjection = layer === "impact" ? projection : techBaseProjection;

  const graphIndex = useMemo(() => {
    if (!graph) return null;
    return buildDependenciesGraphIndex(graph);
  }, [graph]);

  const topDependencies = useMemo(() => {
    if (!graph) return [];
    return countDependencyEdgesByKind(graph);
  }, [graph]);

  const selectedNode = useMemo((): SoftwareGraphNode | null => {
    if (layer === "impact" || !selectedNodeId || !graph) return null;
    const direct = graphIndex?.nodeById.get(selectedNodeId) ?? null;
    if (direct) return direct;
    if (!selectedNodeId.startsWith("semantic:") || !semanticModel) return null;

    const representative = resolveSemanticRepresentativeNode(selectedNodeId, graph, semanticModel);
    if (representative) return representative;

    const canvasNode = projection.nodes.find((node) => node.id === selectedNodeId);
    if (!canvasNode) return null;
    return {
      id: selectedNodeId,
      kind: "service",
      label: canvasNode.label,
      metadata: { semanticEntityId: selectedNodeId },
    };
  }, [graph, graphIndex, layer, projection.nodes, selectedNodeId, semanticModel]);

  const selection = useMemo(() => {
    if (layer === "impact" || !graphIndex || !selectedEdgeId) return null;
    const direct = getEdgeEvidenceFromIndex(graphIndex, selectedEdgeId);
    if (direct) return direct;

    const underlyingIds = techBaseProjection.underlyingEdgeIdsByEdgeId?.get(selectedEdgeId);
    if (!underlyingIds || underlyingIds.length === 0) return null;

    const firstEdge = graphIndex.edgeById.get(underlyingIds[0]!);
    if (!firstEdge) return null;

    const evidence = underlyingIds.flatMap(
      (edgeId) => graphIndex.evidenceByEdgeId.get(edgeId) ?? [],
    );
    return { edge: firstEdge, evidence };
  }, [graphIndex, layer, selectedEdgeId, techBaseProjection.underlyingEdgeIdsByEdgeId]);

  const nodeSummary = useMemo(() => {
    if (layer === "impact" || !selectedNodeId) return null;
    if (selectedNodeId.startsWith("semantic:")) {
      let incoming = 0;
      let outgoing = 0;
      for (const edge of projection.edges) {
        if (edge.target === selectedNodeId) incoming += 1;
        if (edge.source === selectedNodeId) outgoing += 1;
      }
      return { incoming, outgoing, neighbors: [] };
    }
    if (!graphIndex) return null;
    return getNodeDependencySummaryFromIndex(graphIndex, selectedNodeId);
  }, [graphIndex, layer, projection.edges, selectedNodeId]);

  const codeSelection = useMemo(() => {
    if (!selectedNode || !graph) return null;
    return selectionFromNode(selectedNode, graph.nodes);
  }, [graph, selectedNode]);

  const codeExcerpt = useMemo(() => {
    if (!graph || !codeSelection?.filePath) return null;
    const match = graph.evidence.find((item) => item.filePath === codeSelection.filePath);
    return match?.excerpt ?? null;
  }, [codeSelection, graph]);

  useEffect(() => {
    if (!graph) return;
    const visibleNodeIds = new Set(projection.nodes.map((node) => node.id));

    if (selectedNodeId) {
      if (!visibleNodeIds.has(selectedNodeId)) {
        setSelectedNodeId(null);
      }
      return;
    }

    if (layer === "impact") return;
    if (projection.nodes.length === 0) return;
    const preferred =
      projection.nodes.find((node) => {
        const graphNode = graph.nodes.find((candidate) => candidate.id === node.id);
        return Boolean(graphNode?.filePath);
      }) ?? projection.nodes[0]!;
    setSelectedNodeId(preferred.id);
  }, [graph, layer, projection.nodes, selectedNodeId]);

  useEffect(() => {
    if (!selectedEdgeId) return;
    const visibleEdgeIds = new Set(projection.edges.map((edge) => edge.id));
    if (!visibleEdgeIds.has(selectedEdgeId)) {
      setSelectedEdgeId(null);
    }
  }, [projection.edges, selectedEdgeId]);

  const handleLayerChange = (next: DependenciesLayer) => {
    setLayer(next);
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    if (next === "impact") {
      setFocusSemanticEntityId(null);
    } else if (next === "technik") {
      setFocusConceptId(null);
      setFocusSemanticEntityId(null);
    } else {
      setFocusConceptId(null);
    }
  };

  const handleNodeSelect = (nodeId: string | null) => {
    setSelectedNodeId(nodeId);
    setSelectedEdgeId(null);
    if (layer === "impact" && nodeId) {
      setFocusConceptId(nodeId);
      if (isProductConceptSelectionId(nodeId)) {
        setSelection(nodeId, null, "dependencies");
      }
    }
  };

  const handleEdgeSelect = (edgeId: string | null) => {
    setSelectedEdgeId(edgeId);
    if (edgeId) setSelectedNodeId(null);
  };

  const handleDrillIntoSelected = () => {
    if (!selectedNodeId?.startsWith("semantic:")) return;
    setFocusSemanticEntityId(selectedNodeId);
    setLayer("files");
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
  };

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
    setActiveOverlays(new Set());
    setShowOrphans(true);
    setSelectedEdgeId(null);
    resetSearch();
  };

  if (!graph) {
    return (
      <BlueprintViewStateGate
        viewId="dependencies"
        hasViewData={false}
        scanStatus={scanStatus}
        scanError={scanError}
        onRetry={onRetry}
      >
        {null}
      </BlueprintViewStateGate>
    );
  }

  const hasVisibleGraph = projection.nodes.length > 0;
  const totalFiles = blueprint.totalFiles ?? null;
  const filesAnalyzed = blueprint.filesAnalyzed ?? 0;
  const isPartialScan =
    graph.condensed === true ||
    (totalFiles != null && filesAnalyzed > 0 && filesAnalyzed < totalFiles) ||
    (blueprint.truncation as { truncated?: boolean } | undefined)?.truncated === true;

  const handleMinimapSelect = (nodeId: string) => {
    setSelectedNodeId(nodeId);
    setSelectedEdgeId(null);
    if (layer === "impact") {
      setFocusConceptId(nodeId);
      if (isProductConceptSelectionId(nodeId)) {
        setSelection(nodeId, null, "dependencies");
      }
      const canvasNode = projection.nodes.find((node) => node.id === nodeId);
      if (canvasNode) {
        setSearchQuery(canvasNode.label);
        searchInputRef.current?.focus();
      }
      return;
    }
    const graphNode = graph.nodes.find((candidate) => candidate.id === nodeId);
    if (!graphNode) return;
    setSearchQuery(graphNode.label);
    searchInputRef.current?.focus();
  };

  return (
    <>
      {dependenciesFocus && !dependenciesFocus.presentInView && productSelection ? (
        <ProductConceptMissingInView
          selection={productSelection}
          messageDe={dependenciesFocus.messageDe}
        />
      ) : null}
      <BlueprintViewLayout
        controls={
          <div>
            <DependenciesLayerNav layer={layer} onChange={handleLayerChange} />
            {layer === "impact" ? (
              <div className={styles.impactControls} data-testid="dependencies-impact-controls">
                <p className={styles.impactIntro}>
                  Change Impact: direkte und begrenzt transitive fachliche Auswirkungen.
                </p>
                {focusConceptId ? (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm mb-2"
                    data-testid="impact-overview"
                    onClick={() => {
                      setFocusConceptId(null);
                      setSelectedNodeId(null);
                      setSelectedEdgeId(null);
                    }}
                  >
                    ← Impact-Übersicht
                  </button>
                ) : null}
                <button
                  type="button"
                  className="btn btn-ghost btn-sm mb-2"
                  data-testid="dependencies-open-technik"
                  onClick={() => handleLayerChange("technik")}
                >
                  Technik anzeigen
                </button>
              </div>
            ) : (
              <>
                {layer === "files" ? (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm mb-2"
                    onClick={() => handleLayerChange("technik")}
                  >
                    ← Semantik-Übersicht
                  </button>
                ) : selectedNodeId?.startsWith("semantic:") ? (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm mb-2"
                    data-testid="dependencies-drill-down"
                    onClick={handleDrillIntoSelected}
                  >
                    Dateien anzeigen
                  </button>
                ) : null}
                <DependenciesOverlayToggles
                  activeOverlays={activeOverlays}
                  onToggle={(overlay) => {
                    setActiveOverlays((current) => {
                      const next = new Set(current);
                      if (next.has(overlay)) next.delete(overlay);
                      else next.add(overlay);
                      return next;
                    });
                    setSelectedEdgeId(null);
                  }}
                />
                <DependenciesControls
                  visibleEdgeKinds={visibleEdgeKinds}
                  topDependencies={topDependencies}
                  showOrphans={showOrphans}
                  orphanCount={searchedTechProjection.orphanNodeIds.length}
                  onToggleEdgeKind={toggleEdgeKind}
                  onToggleOrphans={() => setShowOrphans((current) => !current)}
                  onResetFilters={resetFilters}
                />
              </>
            )}
          </div>
        }
        canvas={
          <div className={styles.canvasWrap}>
            {isPartialScan ? (
              <TruncationBanner analyzed={filesAnalyzed} total={totalFiles} />
            ) : null}
            {layer === "impact" && impactProjection?.partialReason ? (
              <p className={styles.impactBanner} data-testid="impact-partial-banner">
                {impactProjection.partialReason}
              </p>
            ) : null}
            {hasVisibleGraph ? (
              <DependenciesGraphCanvas
                nodes={projection.nodes}
                edges={projection.edges}
                totalNodes={baseProjection.nodes.length}
                totalEdges={baseProjection.edges.length}
                orphanCount={projection.orphanNodeIds.length}
                orphanNodeIds={projection.orphanNodeIds}
                selectedNodeId={selectedNodeId}
                highlightedNodeIds={codeSelection?.relatedNodeIds}
                searchQuery={searchQuery}
                searchInputRef={searchInputRef}
                onSearchChange={setSearchQuery}
                onResetSearch={resetSearch}
                onNodeSelect={handleNodeSelect}
                onEdgeSelect={handleEdgeSelect}
                onMinimapSelect={handleMinimapSelect}
              />
            ) : (
              <div className={styles.filteredCanvasEmpty} data-testid="dependencies-impact-empty">
                <p>
                  {layer === "impact"
                    ? searchQuery
                      ? "Keine Produktkonzepte für die aktuelle Suche."
                      : "Noch keine fachlichen Impact-Beziehungen aus den Scan-Signalen ableitbar. Technik-Topology bleibt unter „Technik“."
                    : searchQuery
                      ? "Keine Module für die aktuelle Suche. Passe den Suchbegriff an."
                      : "Passe die Beziehungstypen an, um Abhängigkeiten anzuzeigen."}
                </p>
              </div>
            )}
          </div>
        }
        inspector={
          layer === "impact" && impactProjection ? (
            <DependenciesImpactInspector
              projection={impactProjection}
              nodes={projection.nodes}
              selectedNodeId={selectedNodeId}
              selectedEdgeId={selectedEdgeId}
              onClearFocus={() => {
                setFocusConceptId(null);
                setSelectedNodeId(null);
                setSelectedEdgeId(null);
              }}
              onSelectRelation={(relationId) => {
                setSelectedEdgeId(relationId);
                setSelectedNodeId(null);
              }}
            />
          ) : (
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
              codeSelection={codeSelection}
              codeExcerpt={codeExcerpt}
              onSelectCodeNode={handleNodeSelect}
              localPath={
                typeof blueprint.repo === "string" && !/^https?:\/\//i.test(blueprint.repo)
                  ? blueprint.repo
                  : null
              }
              repoUrl={
                (typeof blueprint.repoUrl === "string" && blueprint.repoUrl) ||
                (typeof blueprint.repo === "string" &&
                /^https:\/\/(github\.com|gitlab\.com)\//i.test(blueprint.repo)
                  ? blueprint.repo
                  : null)
              }
            />
          )
        }
      />
    </>
  );
}
