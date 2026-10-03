/**
 * Evolution metrics with sparklines from real snapshot node counts (RVP-11).
 * Neu/Geändert/Entfernt come from snapshot diff — never from commit count.
 */

import type { GitSummary, SoftwareGraphDiffMetadata, SoftwareGraphSnapshot } from "../../types";
import { MetricCard } from "../ui/MetricCard.js";
import { ViewSectionTitle } from "../ui/ViewSectionTitle.js";
import styles from "../../styles/EvolutionView.module.css";

interface EvolutionMetricsRowProps {
  diff: SoftwareGraphDiffMetadata | null;
  gitSummary: GitSummary | null;
  snapshots: SoftwareGraphSnapshot[];
  /** False when fewer than two snapshots — architecture trends unavailable. */
  hasSemanticHistory: boolean;
}

function snapshotNodeSparkline(snapshots: SoftwareGraphSnapshot[]): number[] {
  return snapshots.slice(-6).map((snapshot) => snapshot.nodeIds.length);
}

export function EvolutionMetricsRow({
  diff,
  gitSummary,
  snapshots,
  hasSemanticHistory,
}: EvolutionMetricsRowProps): JSX.Element {
  const added = hasSemanticHistory ? (diff?.addedNodeIds.length ?? 0) : 0;
  const changed = hasSemanticHistory ? (diff?.changedNodeIds.length ?? 0) : 0;
  const removed = hasSemanticHistory ? (diff?.removedNodeIds.length ?? 0) : 0;
  const totalNodes = added + changed + removed;
  const commits = gitSummary?.commits.length ?? 0;
  const working =
    (gitSummary?.workingTree.added.length ?? 0) +
    (gitSummary?.workingTree.modified.length ?? 0) +
    (gitSummary?.workingTree.deleted.length ?? 0);

  const sparkline = snapshotNodeSparkline(snapshots);
  const architectureSpark = sparkline.length > 0 ? sparkline : [0];

  const metrics = [
    { label: "Neu", value: added, accent: "green" as const, spark: architectureSpark },
    { label: "Geändert", value: changed, accent: "amber" as const, spark: architectureSpark },
    { label: "Entfernt", value: removed, accent: "orange" as const, spark: architectureSpark },
    { label: "Knoten Δ", value: totalNodes, accent: "purple" as const, spark: architectureSpark },
    {
      label: "Commits",
      value: commits,
      accent: "blue" as const,
      // Commit count is git metadata only — do not reuse as architecture sparkline.
      spark: [commits],
    },
    { label: "Working Tree", value: working, accent: "teal" as const, spark: [working] },
  ];

  return (
    <section className={styles.metricsSection}>
      <ViewSectionTitle>Evolutions-Metriken</ViewSectionTitle>
      {!hasSemanticHistory ? (
        <p className={styles.hint} data-testid="evolution-metrics-no-history">
          Architektur-Trends benötigen mindestens zwei Engine-Snapshots. Commit-Anzahl ist kein
          Ersatz.
        </p>
      ) : null}
      <div className={styles.metricsRow}>
        {metrics.map((metric) => (
          <MetricCard
            key={metric.label}
            label={metric.label}
            value={String(metric.value)}
            accent={metric.accent}
            sparklineValues={metric.spark}
            testId="evolution-metric-card"
          />
        ))}
      </div>
    </section>
  );
}
