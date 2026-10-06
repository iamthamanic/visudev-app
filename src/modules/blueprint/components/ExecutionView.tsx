/**
 * ExecutionView — Product Understanding user-to-system stories by default (PU-10).
 * Technical route pipelines remain available as drill-down.
 * Location: src/modules/blueprint/components/ExecutionView.tsx
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
import { ExecutionSequenceStrip } from "./execution/ExecutionSequenceStrip.js";
import {
  computeExecutionMetrics,
  computeStepTimings,
  findStepEvidence,
  isExecutionLive,
  listExecutionRoutes,
  projectExecutionGraph,
} from "./execution/_projection.js";
import {
  resolveExecutionObservationClass,
  type ExecutionObservationClass,
} from "./execution/execution-observation.js";
import { resolveExecutionStoriesProjection } from "./execution/resolve-execution-product-model.js";
import type { ExecutionStoryView } from "../../../../shared/product-understanding/index.js";
import { atlasKnowledgeStatusLabel } from "./atlas/atlas-knowledge-status.js";
import styles from "../styles/ExecutionView.module.css";
import { BlueprintViewStateGate } from "./ui/BlueprintViewStateGate.js";
import type { BlueprintViewScanProps } from "../blueprint-view-state.js";

interface ExecutionViewProps extends BlueprintViewScanProps {
  blueprint: BlueprintData;
}

type ExecutionLayer = "stories" | "routes";

export function ExecutionView({ blueprint, scanStatus, scanError, onRetry }: ExecutionViewProps) {
  const graph = blueprint.graph;
  const storiesProjection = useMemo(
    () => resolveExecutionStoriesProjection(blueprint, graph),
    [blueprint, graph],
  );
  const stories = useMemo(() => storiesProjection?.stories ?? [], [storiesProjection]);
  const routes = useMemo(() => (graph ? listExecutionRoutes(graph) : []), [graph]);

  const [layer, setLayer] = useState<ExecutionLayer>("stories");
  const [selectedStoryId, setSelectedStoryId] = useState<string | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);

  useEffect(() => {
    if (stories.length === 0) {
      if (routes.length > 0) setLayer("routes");
      setSelectedStoryId(null);
      return;
    }
    if (!selectedStoryId || !stories.some((story) => story.id === selectedStoryId)) {
      setSelectedStoryId(stories[0]!.id);
    }
  }, [routes.length, selectedStoryId, stories]);

  useEffect(() => {
    if (routes.length === 0) {
      setSelectedRouteId(null);
      return;
    }
    if (!selectedRouteId || !routes.some((route) => route.routeId === selectedRouteId)) {
      setSelectedRouteId(routes[0]!.routeId);
    }
  }, [routes, selectedRouteId]);

  const selectedStory: ExecutionStoryView | null = useMemo(() => {
    if (!selectedStoryId) return null;
    return stories.find((story) => story.id === selectedStoryId) ?? null;
  }, [selectedStoryId, stories]);

  const activeRouteId =
    layer === "stories"
      ? (selectedStory?.routeId ?? selectedRouteId ?? routes[0]?.routeId ?? null)
      : (selectedRouteId ?? routes[0]?.routeId ?? null);

  const projection = useMemo(() => {
    if (!graph || !activeRouteId || layer === "stories") return null;
    return projectExecutionGraph(graph, { routeId: activeRouteId });
  }, [activeRouteId, graph, layer]);

  useEffect(() => {
    if (layer === "stories") {
      if (!selectedStory || selectedStory.steps.length === 0) {
        setSelectedStepId(null);
        return;
      }
      if (!selectedStepId || !selectedStory.steps.some((step) => step.id === selectedStepId)) {
        setSelectedStepId(selectedStory.steps[0]!.id);
      }
      return;
    }
    if (!projection || projection.stepNodeIds.length === 0) {
      setSelectedStepId(null);
      return;
    }
    if (!selectedStepId || !projection.stepNodeIds.includes(selectedStepId)) {
      setSelectedStepId(projection.stepNodeIds[0] ?? null);
    }
  }, [layer, projection, selectedStepId, selectedStory]);

  const storyStepNodeIds = useMemo(
    () => (selectedStory ? selectedStory.steps.map((step) => step.id) : []),
    [selectedStory],
  );

  const stepLabels = useMemo(() => {
    const labels = new Map<string, string>();
    if (layer === "stories" && selectedStory) {
      for (const step of selectedStory.steps) {
        labels.set(step.id, step.label);
      }
      return labels;
    }
    if (!graph || !projection) return labels;
    for (const nodeId of projection.stepNodeIds) {
      const node = graph.nodes.find((candidate) => candidate.id === nodeId);
      if (node) labels.set(nodeId, node.label);
    }
    return labels;
  }, [graph, layer, projection, selectedStory]);

  const stepKinds = useMemo(() => {
    const kinds = new Map<string, SoftwareGraphNodeKind>();
    if (layer === "stories" && selectedStory) {
      for (const step of selectedStory.steps) {
        kinds.set(
          step.id,
          step.role === "data" ? "table" : step.role === "outcome" ? "route" : "service",
        );
      }
      return kinds;
    }
    if (!graph || !projection) return kinds;
    for (const nodeId of projection.stepNodeIds) {
      const node = graph.nodes.find((candidate) => candidate.id === nodeId);
      if (node) kinds.set(nodeId, node.kind);
    }
    return kinds;
  }, [graph, layer, projection, selectedStory]);

  const stepHasEvidence = useMemo(() => {
    const map = new Map<string, boolean>();
    if (layer === "stories" && selectedStory) {
      for (const step of selectedStory.steps) {
        map.set(step.id, step.evidenceCount > 0);
      }
      return map;
    }
    if (!graph || !projection) return map;
    for (const nodeId of projection.stepNodeIds) {
      map.set(nodeId, findStepEvidence(graph, nodeId).length > 0);
    }
    return map;
  }, [graph, layer, projection, selectedStory]);

  const stepObservations = useMemo(() => {
    const map = new Map<string, ExecutionObservationClass>();
    if (layer === "stories" && selectedStory) {
      for (const step of selectedStory.steps) {
        map.set(step.id, step.observationClass);
      }
      return map;
    }
    if (!graph || !projection) return map;
    const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
    for (const nodeId of projection.stepNodeIds) {
      map.set(nodeId, resolveExecutionObservationClass(nodeById.get(nodeId), graph));
    }
    return map;
  }, [graph, layer, projection, selectedStory]);

  const selectedEvidence = useMemo(() => {
    if (layer === "stories") return [];
    return graph ? findStepEvidence(graph, selectedStepId) : [];
  }, [graph, layer, selectedStepId]);

  const stepTimings = useMemo(() => {
    if (layer === "stories" && selectedStory) {
      return selectedStory.steps.map((step) => ({
        nodeId: step.id,
        durationMs: null,
        startMs: null,
        endMs: null,
        hasMeasuredTiming: false,
      }));
    }
    if (!graph || !projection) return [];
    return computeStepTimings(graph, projection.stepNodeIds);
  }, [graph, layer, projection, selectedStory]);

  const executionMetrics = useMemo(
    () =>
      graph && layer === "routes"
        ? computeExecutionMetrics(projection, graph)
        : {
            totalDurationMs: null,
            stepCount: layer === "stories" ? (selectedStory?.steps.length ?? 0) : 0,
            errorCount: 0,
            warningCount: 0,
            serviceCount: 0,
            dbCount: 0,
            eventCount: 0,
            payloadCount: 0,
          },
    [graph, layer, projection, selectedStory],
  );

  const isLive = useMemo(() => {
    if (!graph || !activeRouteId || layer === "stories") return false;
    return isExecutionLive(graph, activeRouteId);
  }, [activeRouteId, graph, layer]);

  const handleSelectStory = (storyId: string) => {
    setSelectedStoryId(storyId);
    setSelectedStepId(null);
    const story = stories.find((entry) => entry.id === storyId);
    if (story?.routeId) setSelectedRouteId(story.routeId);
  };

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
  const pipelineStepIds = layer === "stories" ? storyStepNodeIds : (projection?.stepNodeIds ?? []);

  return (
    <div className={styles.root} data-testid="execution-view">
      <header className={styles.header}>
        <ExecutionLiveBadge live={isLive} />
        <label className={styles.select}>
          <span className="sr-only">Execution-Ebene</span>
          <select
            className={styles.select}
            value={layer}
            aria-label="Execution-Ebene wählen"
            data-testid="execution-layer-select"
            onChange={(event) => {
              setLayer(event.target.value as ExecutionLayer);
              setSelectedStepId(null);
            }}
          >
            <option value="stories">Stories</option>
            <option value="routes">Routen (Technik)</option>
          </select>
        </label>
        {layer === "stories" ? (
          <>
            <ViewSectionTitle>Story</ViewSectionTitle>
            {stories.length === 0 ? (
              <p className={styles.emptyControls} data-testid="execution-stories-empty">
                Keine Nutzeraktionen für Stories ableitbar. Technik-Routen bleiben unter „Routen“.
              </p>
            ) : (
              <select
                className={styles.select}
                value={selectedStoryId ?? ""}
                onChange={(event) => handleSelectStory(event.target.value)}
                aria-label="Story auswählen"
                data-testid="execution-story-select"
              >
                {stories.map((story) => (
                  <option key={story.id} value={story.id}>
                    {story.title}
                  </option>
                ))}
              </select>
            )}
            {storiesProjection?.partialReason ? (
              <p className={styles.emptyControls} data-testid="execution-stories-partial">
                {storiesProjection.partialReason}
              </p>
            ) : null}
            {selectedStory ? (
              <p className={styles.emptyControls} data-testid="execution-story-status">
                {atlasKnowledgeStatusLabel(selectedStory.knowledgeStatus)}
                {selectedStory.confirmed ? "" : " — nicht bestätigt"}
                {selectedStory.routeId ? " · Route verknüpft" : ""}
              </p>
            ) : null}
          </>
        ) : (
          <>
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
          </>
        )}
      </header>

      <div className={styles.sequenceSlot}>
        {layer === "routes" ? (
          <ExecutionSequenceStrip graph={graph} routeNodeId={activeRouteId} />
        ) : selectedStory ? (
          <p className={styles.emptyControls} data-testid="execution-story-summary">
            {selectedStory.summary}
          </p>
        ) : null}
      </div>

      <ExecutionStepPipeline
        stepNodeIds={pipelineStepIds}
        stepLabels={stepLabels}
        stepKinds={stepKinds}
        stepTimings={stepTimings}
        stepObservations={stepObservations}
        selectedStepId={selectedStepId}
        stepHasEvidence={stepHasEvidence}
        cycleNodeId={layer === "routes" ? (projection?.cycleNodeId ?? null) : null}
        onSelectStep={setSelectedStepId}
      />

      <ExecutionTimelineRuler stepTimings={stepTimings} />
      <ExecutionMetricsBar metrics={executionMetrics} />

      <BlueprintViewLayout
        controls={
          <ExecutionSchritteList
            stepNodeIds={pipelineStepIds}
            stepLabels={stepLabels}
            stepKinds={stepKinds}
            selectedStepId={selectedStepId}
            cycleNodeId={layer === "routes" ? (projection?.cycleNodeId ?? null) : null}
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
