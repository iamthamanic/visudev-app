/**
 * Architecture view — Product Understanding responsibilities by default (PU-08).
 * Layer/module stacks remain as technical detail levels.
 * Location: src/modules/blueprint/components/ArchitectureView.tsx
 */

import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import type { BlueprintData, SoftwareGraphNodeKind } from "../types";
import { BlueprintViewLayout } from "./ui/BlueprintViewLayout.js";
import { applyArchitectureNodeColors } from "./architecture/_apply-colors.js";
import { ArchitectureControls } from "./architecture/ArchitectureControls.js";
import { ArchitectureDomainGroups } from "./architecture/ArchitectureDomainGroups.js";
import { ArchitectureGroupingToggle } from "./architecture/ArchitectureGroupingToggle.js";
import { ArchitectureInspector } from "./architecture/ArchitectureInspector.js";
import { ArchitectureLayerStack } from "./architecture/ArchitectureLayerStack.js";
import { ArchitectureResponsibilityMap } from "./architecture/ArchitectureResponsibilityMap.js";
import { ArchitectureSemanticKindBar } from "./architecture/ArchitectureSemanticKindBar.js";
import {
  GROUPING_STACK_KIND,
  GROUPING_VISIBLE_KINDS,
  type ArchitectureGroupingMode,
} from "./architecture/architecture-grouping.js";
import {
  buildArchitectureStackCards,
  groupArchitectureCardsBySemanticDomains,
  summarizeArchitectureSemanticKinds,
} from "./architecture/build-layer-stack.js";
import { projectArchitectureGraph } from "./architecture/_projection.js";
import { resolveArchitectureSemanticModel } from "./architecture/resolve-architecture-semantic-model.js";
import { resolveArchitectureResponsibilityProjection } from "./architecture/resolve-architecture-product-model.js";
import {
  ArchitectureLevelNav,
  type ArchitectureLevel,
} from "./architecture/ArchitectureLevelNav.js";
import { useArchitectureDefaultLayerSelection } from "../hooks/useArchitectureDefaultLayerSelection.js";
import { buildGraphSnapshotKey } from "../services/graph-snapshot-key.js";
import { BlueprintViewStateGate } from "./ui/BlueprintViewStateGate.js";
import type { BlueprintViewScanProps } from "../blueprint-view-state.js";
import styles from "../styles/ArchitectureView.module.css";

const GraphCanvas = lazy(() =>
  import("../../../components/GraphCanvas").then((module) => ({ default: module.GraphCanvas })),
);

const LEVEL_VISIBLE_KINDS: Record<ArchitectureLevel, SoftwareGraphNodeKind[]> = {
  system: ["organization", "application"],
  domain: ["domain", "application"],
  capability: ["module", "service", "domain"],
  module: ["module", "domain", "layer", "service", "table"],
  file: ["file", "module", "route", "service"],
};

const RESPONSIBILITY_LEVELS = new Set<ArchitectureLevel>(["system", "domain", "capability"]);

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
  const [level, setLevel] = useState<ArchitectureLevel>("domain");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedResponsibilityId, setSelectedResponsibilityId] = useState<string | null>(null);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(() => new Set());
  const [visibleKinds, setVisibleKinds] = useState<Set<SoftwareGraphNodeKind>>(
    () => new Set(GROUPING_VISIBLE_KINDS.layers),
  );

  const graphSnapshotKey = buildGraphSnapshotKey(graph);
  const showResponsibilityMap = RESPONSIBILITY_LEVELS.has(level);

  useEffect(() => {
    setVisibleKinds(new Set(GROUPING_VISIBLE_KINDS[groupingMode]));
    if (groupingMode !== "layers") {
      setSelectedNodeId(null);
    }
  }, [groupingMode]);

  useEffect(() => {
    setVisibleKinds(new Set(LEVEL_VISIBLE_KINDS[level]));
    if (RESPONSIBILITY_LEVELS.has(level)) {
      setSelectedNodeId(null);
    } else {
      setSelectedResponsibilityId(null);
    }
  }, [level]);

  useArchitectureDefaultLayerSelection(graph, groupingMode, setSelectedNodeId, graphSnapshotKey);

  const responsibilityProjection = useMemo(
    () => resolveArchitectureResponsibilityProjection(blueprint, graph),
    [blueprint, graph],
  );

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

  const semanticModel = useMemo(
    () => resolveArchitectureSemanticModel(blueprint, graph),
    [blueprint, graph],
  );

  const domainGroups = useMemo(() => {
    if (!graph || groupingMode !== "layers") return [];
    return groupArchitectureCardsBySemanticDomains(graph, stackCards, semanticModel);
  }, [graph, groupingMode, stackCards, semanticModel]);

  const kindSummaries = useMemo(
    () => summarizeArchitectureSemanticKinds(semanticModel),
    [semanticModel],
  );

  const selectedNode = useMemo(() => {
    if (!graph || !selectedNodeId) return null;
    return graph.nodes.find((node) => node.id === selectedNodeId) ?? null;
  }, [graph, selectedNodeId]);

  const selectedSemanticEntity = useMemo(() => {
    if (!semanticModel || !selectedNodeId) return null;
    const membership = semanticModel.memberships.find(
      (entry) => entry.graphNodeId === selectedNodeId,
    );
    if (!membership) return null;
    return (
      semanticModel.entities.find((entity) => entity.id === membership.semanticEntityId) ?? null
    );
  }, [semanticModel, selectedNodeId]);

  const selectedResponsibility = useMemo(() => {
    if (!responsibilityProjection || !selectedResponsibilityId) return null;
    return (
      responsibilityProjection.cards.find((card) => card.id === selectedResponsibilityId) ?? null
    );
  }, [responsibilityProjection, selectedResponsibilityId]);

  const responsibilityAreas = useMemo(() => {
    if (!responsibilityProjection) return [];
    const byId = new Map(responsibilityProjection.cards.map((card) => [card.id, card]));
    return responsibilityProjection.primaryAreaIds
      .map((id) => byId.get(id))
      .filter((card): card is NonNullable<typeof card> => Boolean(card));
  }, [responsibilityProjection]);

  const capabilitiesByArea = useMemo(() => {
    if (!responsibilityProjection) return {};
    const byId = new Map(responsibilityProjection.cards.map((card) => [card.id, card]));
    const result: Record<string, typeof responsibilityAreas> = {};
    for (const area of responsibilityAreas) {
      result[area.id] = area.childIds
        .map((id) => byId.get(id))
        .filter((card): card is NonNullable<typeof card> => Boolean(card));
    }
    return result;
  }, [responsibilityProjection, responsibilityAreas]);

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
  const semantic = semanticModel;
  const levelAvailable = {
    system:
      Boolean(responsibilityProjection?.applications.length) ||
      !semantic ||
      semantic.entities.some((entity) => entity.kind === "application") ||
      graph.nodes.some((node) => node.kind === "application" || node.kind === "organization"),
    domain:
      Boolean(responsibilityProjection?.primaryAreaIds.length) ||
      Boolean(semantic?.entities.some((entity) => entity.kind === "business-domain")) ||
      graph.nodes.some((node) => node.kind === "domain"),
    capability:
      Boolean(responsibilityProjection?.cards.some((card) => card.kind === "capability")) ||
      Boolean(semantic?.entities.some((entity) => entity.kind === "capability")),
    module:
      graph.nodes.some((node) => node.kind === "module" || node.kind === "service") ||
      Boolean(
        semantic?.entities.some(
          (entity) =>
            entity.kind === "service" ||
            entity.kind === "technical-module" ||
            entity.kind === "data-store" ||
            entity.kind === "resource" ||
            entity.kind === "component",
        ),
      ),
    file: graph.nodes.some((node) => node.kind === "file"),
  };

  const controls = (
    <div className={styles.controlsColumn}>
      {!showStackInCanvas && !showResponsibilityMap ? (
        <ArchitectureLayerStack
          cards={stackCards}
          selectedNodeId={selectedNodeId}
          onSelectNode={setSelectedNodeId}
        />
      ) : null}
      {!showResponsibilityMap ? (
        <ArchitectureControls
          collapsible={architectureProjection.collapsible}
          collapsedIds={collapsedIds}
          visibleKinds={visibleKinds}
          hasVisibleNodes={hasVisibleNodes}
          onToggleCollapse={toggleCollapse}
          onToggleKind={toggleKind}
          onResetFilters={resetFilters}
        />
      ) : null}
    </div>
  );

  const canvas = showResponsibilityMap ? (
    <div className={styles.stackCanvasWrap}>
      <ArchitectureResponsibilityMap
        applications={responsibilityProjection?.applications ?? []}
        areas={responsibilityAreas}
        capabilitiesByArea={capabilitiesByArea}
        selectedId={selectedResponsibilityId}
        partialReason={responsibilityProjection?.partialReason ?? null}
        onSelect={setSelectedResponsibilityId}
      />
    </div>
  ) : showStackInCanvas ? (
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
      {!showResponsibilityMap ? (
        <ArchitectureGroupingToggle mode={groupingMode} onSelectMode={setGroupingMode} />
      ) : null}
      <ArchitectureLevelNav level={level} onChange={setLevel} available={levelAvailable} />
      {!showResponsibilityMap ? <ArchitectureSemanticKindBar summaries={kindSummaries} /> : null}

      <BlueprintViewLayout
        controls={controls}
        canvas={canvas}
        inspector={
          <ArchitectureInspector
            graph={graph}
            node={showResponsibilityMap ? null : selectedNode}
            semanticEntity={showResponsibilityMap ? null : selectedSemanticEntity}
            responsibility={showResponsibilityMap ? selectedResponsibility : null}
          />
        }
      />
    </div>
  );
}
