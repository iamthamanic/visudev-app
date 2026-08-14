/**
 * InfrastructureView — topology diagram Internet→LB→Services→DB with filters and legend.
 */

import { useEffect, useMemo, useState } from "react";
import type { BlueprintData } from "../types";
import { useInfrastructureDefaultNodeSelection } from "../hooks/useInfrastructureDefaultNodeSelection.js";
import { buildGraphSnapshotKey } from "../services/graph-snapshot-key.js";
import { BlueprintViewLayout } from "./ui/BlueprintViewLayout.js";
import { InfrastructureConnectionLegend } from "./infrastructure/InfrastructureConnectionLegend.js";
import { InfrastructureInspector } from "./infrastructure/InfrastructureInspector.js";
import { InfrastructureServiceList } from "./infrastructure/InfrastructureServiceList.js";
import { InfrastructureTopologyDiagram } from "./infrastructure/InfrastructureTopologyDiagram.js";
import { InfrastructurePhysicalTopology } from "./infrastructure/InfrastructurePhysicalTopology.js";
import { InfrastructureTopologyFilters } from "./infrastructure/InfrastructureTopologyFilters.js";
import {
  buildTopologyNodes,
  deploymentFiltersFromGraph,
  filterProjectedNodesByDeployment,
  graphHasPhysicalDescriptors,
  projectPhysicalTopology,
  type TopologyViewFilter,
} from "./infrastructure/build-topology.js";
import { projectInfrastructureGraph } from "./infrastructure/_projection.js";
import styles from "../styles/InfrastructureView.module.css";
import { BlueprintViewStateGate } from "./ui/BlueprintViewStateGate.js";
import type { BlueprintViewScanProps } from "../blueprint-view-state.js";

interface InfrastructureViewProps extends BlueprintViewScanProps {
  blueprint: BlueprintData;
}

export function InfrastructureView({
  blueprint,
  scanStatus,
  scanError,
  onRetry,
}: InfrastructureViewProps) {
  const graph = blueprint.graph;
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const graphSnapshotKey = buildGraphSnapshotKey(graph);
  const [activeEnv, setActiveEnv] = useState<string | null>(null);
  const [activeRegion, setActiveRegion] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<TopologyViewFilter | null>("Logische Topologie");
  const [refreshTick, setRefreshTick] = useState(0);

  const { nodes, edges } = useMemo(() => {
    if (!graph) return { nodes: [], edges: [] };
    return projectInfrastructureGraph(graph);
  }, [graph]);

  const deploymentFilters = useMemo(
    () => (graph ? deploymentFiltersFromGraph(graph) : { envs: [], regions: [] }),
    [graph],
  );

  const filteredNodes = useMemo(() => {
    if (!graph) return [];
    return filterProjectedNodesByDeployment(nodes, graph, activeEnv, activeRegion);
  }, [nodes, graph, activeEnv, activeRegion]);

  const topologyNodes = useMemo(() => buildTopologyNodes(filteredNodes), [filteredNodes]);
  const hasPhysicalTopology = Boolean(graph && graphHasPhysicalDescriptors(graph));
  const physicalProjection = useMemo(() => {
    if (!graph || activeView !== "Physische Topologie") return null;
    return projectPhysicalTopology(graph, new Set(filteredNodes.map((node) => node.id)));
  }, [graph, activeView, filteredNodes]);

  useInfrastructureDefaultNodeSelection(
    topologyNodes,
    selectedNodeId,
    setSelectedNodeId,
    graphSnapshotKey,
  );

  const selectedNode = useMemo(
    () => filteredNodes.find((node) => node.id === selectedNodeId) ?? null,
    [filteredNodes, selectedNodeId],
  );

  const selectedGraphNode = useMemo(
    () => graph?.nodes.find((node) => node.id === selectedNodeId) ?? null,
    [graph, selectedNodeId],
  );

  useEffect(() => {
    if (!selectedNodeId) return;
    const selectionStillVisible = filteredNodes.some((node) => node.id === selectedNodeId);
    if (!selectionStillVisible) {
      setSelectedNodeId(null);
    }
  }, [filteredNodes, selectedNodeId]);

  if (!graph || nodes.length === 0) {
    return (
      <BlueprintViewStateGate
        viewId="infrastructure"
        hasViewData={false}
        scanStatus={scanStatus}
        scanError={scanError}
        onRetry={onRetry}
      >
        {null}
      </BlueprintViewStateGate>
    );
  }

  return (
    <BlueprintViewLayout
      controls={
        <InfrastructureServiceList
          nodes={filteredNodes}
          selectedNodeId={selectedNodeId}
          onSelectNode={setSelectedNodeId}
        />
      }
      canvas={
        <div className={styles.canvasWrap} key={refreshTick}>
          <InfrastructureTopologyFilters
            availableEnvs={deploymentFilters.envs}
            availableRegions={deploymentFilters.regions}
            activeEnv={activeEnv}
            activeRegion={activeRegion}
            activeView={activeView}
            onSelectEnv={setActiveEnv}
            onSelectRegion={setActiveRegion}
            onSelectView={setActiveView}
            onRefresh={() => setRefreshTick((tick) => tick + 1)}
            hasPhysicalTopology={hasPhysicalTopology}
          />
          {activeView === "Physische Topologie" ? (
            physicalProjection ? (
              <InfrastructurePhysicalTopology
                projection={physicalProjection}
                selectedNodeId={selectedNodeId}
                onSelectNode={setSelectedNodeId}
              />
            ) : (
              <p className={styles.topologyMeta} data-testid="infra-physical-empty">
                Keine Compose-/K8s-Services in diesem Filter.
              </p>
            )
          ) : (
            <>
              <InfrastructureTopologyDiagram
                nodes={topologyNodes}
                selectedNodeId={selectedNodeId}
                onSelectNode={setSelectedNodeId}
              />
              <InfrastructureConnectionLegend />
            </>
          )}
          {edges.length > 0 ? (
            <p className={styles.topologyMeta}>{edges.length} Verbindungen im Graph</p>
          ) : null}
        </div>
      }
      inspector={
        <InfrastructureInspector
          node={selectedNode}
          graphNode={selectedGraphNode}
          edges={edges}
          nodes={filteredNodes}
        />
      }
    />
  );
}
