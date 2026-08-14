/**
 * EvolutionView — compare SoftwareGraph snapshots with git timeline and diff highlighting.
 */

import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import type { BlueprintData } from "../types";
import { BlueprintViewLayout } from "./ui/BlueprintViewLayout.js";
import { EvolutionChangesGrid } from "./evolution/EvolutionChangesGrid.js";
import { EvolutionCommitTimeline } from "./evolution/EvolutionCommitTimeline.js";
import { EvolutionControls } from "./evolution/EvolutionControls.js";
import { EvolutionInspector } from "./evolution/EvolutionInspector.js";
import { EvolutionMetricsRow } from "./evolution/EvolutionMetricsRow.js";
import { EvolutionSnapshotCards } from "./evolution/EvolutionSnapshotCards.js";
import { EvolutionSubTabs } from "./evolution/EvolutionSubTabs.js";
import { type EvolutionTabId } from "./evolution/evolution-tabs.js";
import { EvolutionBranchCompare } from "./evolution/EvolutionBranchCompare.js";
import { findSnapshot } from "./evolution/_diff.js";
import { useEvolutionViewState } from "./evolution/useEvolutionViewState.js";
import styles from "../styles/EvolutionView.module.css";
import { BlueprintViewStateGate } from "./ui/BlueprintViewStateGate.js";
import type { BlueprintViewScanProps } from "../blueprint-view-state.js";

const GraphCanvas = lazy(() =>
  import("../../../components/GraphCanvas").then((module) => ({ default: module.GraphCanvas })),
);

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
  const [selectedCommitSha, setSelectedCommitSha] = useState<string | null>(null);
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

  const selectedCommit = useMemo(() => {
    if (!gitSummary) return null;
    const sha = selectedCommitSha ?? gitSummary.commits[0]?.sha ?? null;
    if (!sha) return null;
    return gitSummary.commits.find((commit) => commit.sha === sha) ?? null;
  }, [gitSummary, selectedCommitSha]);

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

  return (
    <div className={styles.root}>
      <EvolutionSubTabs activeTab={activeTab} onSelectTab={setActiveTab} />

      {activeTab === "timeline" ? (
        <>
          <section className={styles.commitTimelineSection}>
            <EvolutionCommitTimeline
              commits={gitSummary?.commits ?? []}
              selectedCommitSha={selectedCommitSha ?? gitSummary?.commits[0]?.sha ?? null}
              onSelectCommit={setSelectedCommitSha}
            />
          </section>

          <EvolutionSnapshotCards
            snapshots={snapshots}
            baseSnapshotId={baseSnapshotId}
            targetSnapshotId={targetSnapshotId}
            onSelectBase={setBaseSnapshotId}
            onSelectTarget={setTargetSnapshotId}
          />
          <EvolutionMetricsRow diff={diff} gitSummary={gitSummary} snapshots={snapshots} />
          <EvolutionChangesGrid diff={diff} gitSummary={gitSummary} />

          <BlueprintViewLayout
            controls={
              <EvolutionControls
                snapshots={snapshots}
                gitSummary={gitSummary}
                gitLoadError={gitLoadError}
                baseSnapshotId={baseSnapshotId}
                targetSnapshotId={targetSnapshotId}
                identical={diff?.identical ?? false}
                condensed={diff?.condensed ?? false}
                onSelectBase={setBaseSnapshotId}
                onSelectTarget={setTargetSnapshotId}
              />
            }
            canvas={
              <div className={styles.canvasWrap}>
                {hasDiffNodes ? (
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
      ) : activeTab === "branch-compare" ? (
        <EvolutionBranchCompare projectId={projectId} gitSummary={gitSummary} />
      ) : activeTab === "commit-diff" ? (
        <div className={styles.placeholderPanel} data-testid="evolution-commit-diff">
          <h2 className={styles.placeholderTitle}>Commit Diff</h2>
          <p className={styles.emptyControls}>Commit-Diff folgt.</p>
        </div>
      ) : null}
    </div>
  );
}
