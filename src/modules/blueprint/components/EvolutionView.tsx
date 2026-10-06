/**
 * EvolutionView — Product Understanding history by default (PU-14);
 * Git/commit/file/graph remain Technik drill-down.
 * Location: src/modules/blueprint/components/EvolutionView.tsx
 */

import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import type { BlueprintData } from "../types";
import { projectEvolutionProductHistoryFromSnapshots } from "../../../../shared/product-understanding/index.js";
import { BlueprintViewLayout } from "./ui/BlueprintViewLayout.js";
import { EvolutionChangesGrid } from "./evolution/EvolutionChangesGrid.js";
import { EvolutionCommitTimeline } from "./evolution/EvolutionCommitTimeline.js";
import { EvolutionControls } from "./evolution/EvolutionControls.js";
import { EvolutionInspector } from "./evolution/EvolutionInspector.js";
import { EvolutionMetricsRow } from "./evolution/EvolutionMetricsRow.js";
import { EvolutionProductHistoryView } from "./evolution/EvolutionProductHistoryView.js";
import { EvolutionSnapshotCards } from "./evolution/EvolutionSnapshotCards.js";
import { EvolutionSubTabs } from "./evolution/EvolutionSubTabs.js";
import { type EvolutionTabId } from "./evolution/evolution-tabs.js";
import { EvolutionBranchCompare } from "./evolution/EvolutionBranchCompare.js";
import { EvolutionCommitDiff } from "./evolution/EvolutionCommitDiff.js";
import { findSnapshot } from "./evolution/_diff.js";
import { useEvolutionViewState } from "./evolution/useEvolutionViewState.js";
import { hasSemanticHistoryCompare } from "../../../../shared/semantic-history.js";
import styles from "../styles/EvolutionView.module.css";
import { BlueprintViewStateGate } from "./ui/BlueprintViewStateGate.js";
import type { BlueprintViewScanProps } from "../blueprint-view-state.js";

const GraphCanvas = lazy(() =>
  import("../../../components/GraphCanvas").then((module) => ({ default: module.GraphCanvas })),
);

type EvolutionLayer = "product" | "technik";

interface EvolutionViewProps extends BlueprintViewScanProps {
  blueprint: BlueprintData;
  projectId?: string;
}

export function EvolutionView({
  blueprint,
  projectId,
  scanStatus,
  scanError,
  onRetry,
}: EvolutionViewProps) {
  const [activeTab, setActiveTab] = useState<EvolutionTabId>("timeline");
  const [layer, setLayer] = useState<EvolutionLayer>("product");
  const [selectedCommitSha, setSelectedCommitSha] = useState<string | null>(null);
  const [selectedHistoryItemId, setSelectedHistoryItemId] = useState<string | null>(null);
  const {
    graph,
    snapshots,
    gitSummary,
    gitLoadError,
    baseSnapshotId,
    targetSnapshotId,
    setBaseSnapshotId,
    setTargetSnapshotId,
    diff,
    projection,
    hasDiffNodes,
  } = useEvolutionViewState(blueprint, projectId);

  useEffect(() => {
    if (!gitSummary || !selectedCommitSha) return;
    const stillExists = gitSummary.commits.some((commit) => commit.sha === selectedCommitSha);
    if (!stillExists) setSelectedCommitSha(null);
  }, [gitSummary, selectedCommitSha]);

  const targetSnapshot = useMemo(() => {
    if (!graph || !targetSnapshotId) return null;
    return findSnapshot(graph, targetSnapshotId) ?? null;
  }, [graph, targetSnapshotId]);

  const baseSnapshot = useMemo(() => {
    if (!graph || !baseSnapshotId) return null;
    return findSnapshot(graph, baseSnapshotId) ?? null;
  }, [graph, baseSnapshotId]);

  const selectedCommit = useMemo(() => {
    if (!gitSummary) return null;
    const sha = selectedCommitSha ?? gitSummary.commits[0]?.sha ?? null;
    if (!sha) return null;
    return gitSummary.commits.find((commit) => commit.sha === sha) ?? null;
  }, [gitSummary, selectedCommitSha]);

  const hasSemanticHistory = hasSemanticHistoryCompare(snapshots);

  const productHistory = useMemo(() => {
    if (!baseSnapshot || !targetSnapshot) return null;
    return projectEvolutionProductHistoryFromSnapshots(baseSnapshot, targetSnapshot);
  }, [baseSnapshot, targetSnapshot]);

  useEffect(() => {
    if (!productHistory || productHistory.previewItems.length === 0) {
      setSelectedHistoryItemId(null);
      return;
    }
    if (
      selectedHistoryItemId &&
      productHistory.previewItems.some((item) => item.id === selectedHistoryItemId)
    ) {
      return;
    }
    setSelectedHistoryItemId(productHistory.previewItems[0]?.id ?? null);
  }, [productHistory, selectedHistoryItemId]);

  if (!graph) {
    return (
      <BlueprintViewStateGate
        viewId="evolution"
        hasViewData={false}
        scanStatus={scanStatus}
        scanError={scanError}
        onRetry={onRetry}
      >
        {null}
      </BlueprintViewStateGate>
    );
  }

  const layerNav = (
    <div className={styles.layerNav} role="tablist" aria-label="Evolution-Ebenen">
      <button
        type="button"
        role="tab"
        className={styles.layerTab}
        data-active={layer === "product" ? "true" : "false"}
        data-testid="evolution-layer-product"
        aria-selected={layer === "product"}
        onClick={() => setLayer("product")}
      >
        Produktgeschichte
      </button>
      <button
        type="button"
        role="tab"
        className={styles.layerTab}
        data-active={layer === "technik" ? "true" : "false"}
        data-testid="evolution-layer-technik"
        aria-selected={layer === "technik"}
        onClick={() => setLayer("technik")}
      >
        Technik
      </button>
    </div>
  );

  return (
    <div className={styles.root}>
      <EvolutionSubTabs activeTab={activeTab} onSelectTab={setActiveTab} />

      {activeTab === "timeline" ? (
        <>
          {layerNav}
          <EvolutionSnapshotCards
            snapshots={snapshots}
            baseSnapshotId={baseSnapshotId}
            targetSnapshotId={targetSnapshotId}
            onSelectBase={setBaseSnapshotId}
            onSelectTarget={setTargetSnapshotId}
          />

          {layer === "product" ? (
            <>
              {!hasSemanticHistory ? (
                <p className={styles.hint} data-testid="evolution-semantic-history-empty">
                  Für semantische Produktgeschichte werden mindestens zwei Engine-Snapshots
                  benötigt. Git-Commits allein ersetzen keine Snapshot-Vergleiche.
                </p>
              ) : null}
              {diff?.comparable === false ? (
                <p className={styles.hint} data-testid="evolution-snapshot-incompatible">
                  {diff.incompatibleReason ||
                    "Diese Snapshots sind inkompatibel und werden nicht verglichen."}
                </p>
              ) : null}
              <EvolutionProductHistoryView
                projection={productHistory}
                selectedItemId={selectedHistoryItemId}
                onSelectItem={setSelectedHistoryItemId}
                onOpenTechnik={() => setLayer("technik")}
              />
            </>
          ) : (
            <>
              <section className={styles.commitTimelineSection}>
                <EvolutionCommitTimeline
                  commits={gitSummary?.commits ?? []}
                  selectedCommitSha={selectedCommitSha ?? gitSummary?.commits[0]?.sha ?? null}
                  onSelectCommit={setSelectedCommitSha}
                />
              </section>
              {!hasSemanticHistory ? (
                <p className={styles.hint} data-testid="evolution-semantic-history-empty">
                  Für semantische Architektur-Evolution werden mindestens zwei Engine-Snapshots
                  benötigt. Git-Commits allein ersetzen keine Snapshot-Vergleiche.
                </p>
              ) : null}
              {diff?.comparable === false ? (
                <p className={styles.hint} data-testid="evolution-snapshot-incompatible">
                  {diff.incompatibleReason ||
                    "Diese Snapshots sind inkompatibel und werden nicht verglichen."}
                </p>
              ) : null}
              <EvolutionMetricsRow
                diff={diff}
                gitSummary={gitSummary}
                snapshots={snapshots}
                hasSemanticHistory={hasSemanticHistory}
              />
              <EvolutionChangesGrid diff={diff} gitSummary={gitSummary} />

              <BlueprintViewLayout
                controls={
                  <EvolutionControls
                    snapshots={snapshots}
                    gitSummary={gitSummary}
                    gitLoadError={gitLoadError}
                    baseSnapshotId={baseSnapshotId}
                    targetSnapshotId={targetSnapshotId}
                    identical={diff?.comparable !== false && (diff?.identical ?? false)}
                    condensed={diff?.condensed ?? false}
                    onSelectBase={setBaseSnapshotId}
                    onSelectTarget={setTargetSnapshotId}
                  />
                }
                canvas={
                  <div className={styles.canvasWrap}>
                    {diff?.comparable === false ? (
                      <div className={styles.filteredCanvasEmpty}>
                        <p>Kein Vergleich — Snapshots sind inkompatibel.</p>
                      </div>
                    ) : hasDiffNodes ? (
                      <Suspense fallback={<p className={styles.loading}>Graph wird geladen...</p>}>
                        <GraphCanvas
                          nodes={projection?.nodes ?? []}
                          edges={projection?.edges ?? []}
                          layoutPreset="force"
                        />
                      </Suspense>
                    ) : (
                      <div className={styles.filteredCanvasEmpty}>
                        <p>
                          {diff?.identical
                            ? "Identische Snapshots — keine hervorgehobenen Knoten."
                            : "Wähle zwei verschiedene Snapshots mit Unterschieden."}
                        </p>
                      </div>
                    )}
                  </div>
                }
                inspector={
                  <EvolutionInspector
                    targetSnapshot={targetSnapshot}
                    diff={diff}
                    gitSummary={gitSummary}
                    selectedCommit={selectedCommit}
                  />
                }
              />
            </>
          )}
        </>
      ) : activeTab === "commit-diff" ? (
        <EvolutionCommitDiff
          projectId={projectId}
          gitSummary={gitSummary}
          preferredHeadSha={selectedCommitSha}
        />
      ) : activeTab === "branch-compare" ? (
        <EvolutionBranchCompare
          projectId={projectId}
          gitSummary={gitSummary}
          graphNodes={graph.nodes}
        />
      ) : null}
    </div>
  );
}
