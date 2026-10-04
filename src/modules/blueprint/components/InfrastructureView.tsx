/**
 * InfrastructureView — evidence-first topology with honest empty/coverage states (PR-15).
 * Location: src/modules/blueprint/components/InfrastructureView.tsx
 */

import { useEffect, useMemo, useState } from "react";
import type { BlueprintData, SoftwareGraphNode } from "../types";
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
import { infrastructureEmptyCopy } from "./infrastructure/infrastructure-coverage.js";
import styles from "../styles/InfrastructureView.module.css";
import { BlueprintViewStateGate } from "./ui/BlueprintViewStateGate.js";
import type { BlueprintViewScanProps } from "../blueprint-view-state.js";
import { TruncationBanner } from "../../../components/ui/TruncationBanner.js";
import { ViewState } from "../../../components/ui/ViewState.js";

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
    return projectInfrastructureGraph(graph, blueprint.semanticSystemModel);
  }, [graph, blueprint.semanticSystemModel]);

  const graphNodesById = useMemo(() => {
    const map = new Map<string, SoftwareGraphNode>();
    if (!graph) return map;
    for (const node of graph.nodes) {
      map.set(node.id, node);
    }
    return map;
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

  const edgeKinds = useMemo(
    () => edges.map((edge) => edge.kind).filter((kind): kind is string => typeof kind === "string"),
    [edges],
  );

  const filesAnalyzed = blueprint.filesAnalyzed ?? 0;
  const totalFiles = blueprint.totalFiles ?? null;
  const isPartialScan =
    graph?.condensed === true ||
    (totalFiles != null && filesAnalyzed > 0 && filesAnalyzed < totalFiles) ||
    (blueprint.truncation as { truncated?: boolean } | undefined)?.truncated === true;

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
    const scanDone = scanStatus === "completed" || (scanStatus == null && Boolean(graph));
    if (scanDone) {
      const empty = infrastructureEmptyCopy(blueprint, nodes.length);
      return (
        <div data-testid="infra-coverage-empty" data-detection={empty.detection}>
          <ViewState
            name="nothing-found"
            title={empty.titleDe}
            detail={`${empty.bodyDe} [${empty.detection}]`}
            onRetry={onRetry}
          />
        </div>
      );
    }
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
          graphNodesById={graphNodesById}
          selectedNodeId={selectedNodeId}
          onSelectNode={setSelectedNodeId}
        />
      }
      canvas={
        <div className={styles.canvasWrap} key={refreshTick}>
          {isPartialScan ? <TruncationBanner analyzed={filesAnalyzed} total={totalFiles} /> : null}
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
                Keine Compose-/K8s-/Dockerfile-Services in diesem Filter (ABSENT für die Auswahl).
              </p>
            )
          ) : (
            <>
              <InfrastructureTopologyDiagram
                nodes={topologyNodes}
                selectedNodeId={selectedNodeId}
                onSelectNode={setSelectedNodeId}
              />
              <InfrastructureConnectionLegend edgeKinds={edgeKinds} />
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
          graph={graph}
          edges={edges}
          nodes={filteredNodes}
        />
      }
    />
  );
}
