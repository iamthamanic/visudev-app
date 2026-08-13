/**
 * ExecutionView — horizontal route execution pipelines from SoftwareGraph paths.
 */

import { useEffect, useMemo, useState } from "react";
import type { BlueprintData, SoftwareGraphNodeKind } from "../types";
import { BlueprintViewLayout } from "./ui/BlueprintViewLayout.js";
import { ViewSectionTitle } from "./ui/ViewSectionTitle.js";
import { ExecutionDetailTabs } from "./execution/ExecutionDetailTabs.js";
import { ExecutionInspector } from "./execution/ExecutionInspector.js";
import { ExecutionLiveBadge } from "./execution/ExecutionLiveBadge.js";
import { ExecutionMetricsBar } from "./execution/ExecutionMetricsBar.js";
import { ExecutionSchritteList } from "./execution/ExecutionSchritteList.js";
import { ExecutionStepPipeline } from "./execution/ExecutionStepPipeline.js";
import { ExecutionTimelineRuler } from "./execution/ExecutionTimelineRuler.js";
import {
  computeExecutionMetrics,
  computeStepTimings,
  findStepEvidence,
  isExecutionLive,
  listExecutionRoutes,
  projectExecutionGraph,
} from "./execution/_projection.js";
import styles from "../styles/ExecutionView.module.css";
import { BlueprintViewStateGate } from "./ui/BlueprintViewStateGate.js";
import type { BlueprintViewScanProps } from "../blueprint-view-state.js";

interface ExecutionViewProps extends BlueprintViewScanProps {
  blueprint: BlueprintData;
}

export function ExecutionView({ blueprint, scanStatus, scanError, onRetry }: ExecutionViewProps) {
  const graph = blueprint.graph;
  const routes = useMemo(() => (graph ? listExecutionRoutes(graph) : []), [graph]);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);

  useEffect(() => {
    if (routes.length === 0) {
      setSelectedRouteId(null);
      return;
    }
    if (!selectedRouteId || !routes.some((route) => route.routeId === selectedRouteId)) {
      setSelectedRouteId(routes[0].routeId);
    }
  }, [routes, selectedRouteId]);

  const projection = useMemo(() => {
    if (!graph || !selectedRouteId) return null;
    return projectExecutionGraph(graph, { routeId: selectedRouteId });
  }, [graph, selectedRouteId]);

  useEffect(() => {
    if (!projection || projection.stepNodeIds.length === 0) {
      setSelectedStepId(null);
      return;
    }
    if (!selectedStepId || !projection.stepNodeIds.includes(selectedStepId)) {
      setSelectedStepId(projection.stepNodeIds[0] ?? null);
    }
  }, [projection, selectedStepId]);

  const stepLabels = useMemo(() => {
    const labels = new Map<string, string>();
    if (!graph || !projection) return labels;
    for (const nodeId of projection.stepNodeIds) {
      const node = graph.nodes.find((candidate) => candidate.id === nodeId);
      if (node) labels.set(nodeId, node.label);
    }
    return labels;
  }, [graph, projection]);

  const stepKinds = useMemo(() => {
    const kinds = new Map<string, SoftwareGraphNodeKind>();
    if (!graph || !projection) return kinds;
    for (const nodeId of projection.stepNodeIds) {
      const node = graph.nodes.find((candidate) => candidate.id === nodeId);
      if (node) kinds.set(nodeId, node.kind);
    }
    return kinds;
  }, [graph, projection]);

  const stepHasEvidence = useMemo(() => {
    const map = new Map<string, boolean>();
    if (!graph || !projection) return map;
    for (const nodeId of projection.stepNodeIds) {
      map.set(nodeId, findStepEvidence(graph, nodeId).length > 0);
    }
    return map;
  }, [graph, projection]);

  const selectedEvidence = useMemo(
    () => (graph ? findStepEvidence(graph, selectedStepId) : []),
    [graph, selectedStepId],
  );

  const activeRouteId = selectedRouteId ?? routes[0]?.routeId ?? null;

  const stepTimings = useMemo(() => {
    if (!graph || !projection) return [];
    return computeStepTimings(graph, projection.stepNodeIds);
  }, [graph, projection]);

  const executionMetrics = useMemo(
    () =>
      graph
        ? computeExecutionMetrics(projection, graph)
        : {
            totalDurationMs: 0,
            stepCount: 0,
            errorCount: 0,
            warningCount: 0,
            serviceCount: 0,
            dbCount: 0,
            eventCount: 0,
            payloadCount: 0,
          },
    [graph, projection],
  );

  const isLive = useMemo(() => {
    if (!graph || !activeRouteId) return false;
    return isExecutionLive(graph, activeRouteId);
  }, [graph, activeRouteId]);

  const handleSelectRoute = (routeId: string) => {
    setSelectedRouteId(routeId);
    setSelectedStepId(null);
  };

  if (!graph) {
    return (
      <BlueprintViewStateGate
        viewId="execution"
        hasViewData={false}
        scanStatus={scanStatus}
        scanError={scanError}
        onRetry={onRetry}
      >
        {null}
      </BlueprintViewStateGate>
    );
  }

  const selectedStepLabel = selectedStepId ? (stepLabels.get(selectedStepId) ?? null) : null;
  const selectedStepKind = selectedStepId ? (stepKinds.get(selectedStepId) ?? null) : null;

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <ExecutionLiveBadge live={isLive} />
        <ViewSectionTitle>Route</ViewSectionTitle>
        {routes.length === 0 ? (
          <p className={styles.emptyControls}>
            Keine HTTP-Routen im Graph. Non-HTTP Surfaces (z.&nbsp;B. Meteor Methods) brauchen
            Extractor-Support — siehe Atlas/Dependencies.
          </p>
        ) : (
          <select
            className={styles.select}
            value={activeRouteId ?? ""}
            onChange={(event) => handleSelectRoute(event.target.value)}
            aria-label="Route auswählen"
          >
            {routes.map((route) => (
              <option key={route.routeId} value={route.routeId}>
                {route.label}
              </option>
            ))}
          </select>
        )}
      </header>

      <ExecutionStepPipeline
        stepNodeIds={projection?.stepNodeIds ?? []}
        stepLabels={stepLabels}
        stepKinds={stepKinds}
        stepTimings={stepTimings}
        selectedStepId={selectedStepId}
        stepHasEvidence={stepHasEvidence}
        cycleNodeId={projection?.cycleNodeId ?? null}
        onSelectStep={setSelectedStepId}
      />

      <ExecutionTimelineRuler stepTimings={stepTimings} />
      <ExecutionMetricsBar metrics={executionMetrics} />

      <BlueprintViewLayout
        controls={
          <ExecutionSchritteList
            stepNodeIds={projection?.stepNodeIds ?? []}
            stepLabels={stepLabels}
            stepKinds={stepKinds}
            selectedStepId={selectedStepId}
            cycleNodeId={projection?.cycleNodeId ?? null}
            onSelectStep={setSelectedStepId}
          />
        }
        canvas={
          <ExecutionDetailTabs
            stepLabel={selectedStepLabel}
            stepKind={selectedStepKind}
            selectedEvidence={selectedEvidence}
          />
        }
        inspector={
          <ExecutionInspector
            stepLabel={selectedStepLabel}
            stepKind={selectedStepKind}
            selectedEvidence={selectedEvidence}
          />
        }
      />
    </div>
  );
}
