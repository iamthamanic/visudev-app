/**
 * RVP-10 root-cause cluster overview for Diagnostics Security tab.
 * Location: src/modules/blueprint/components/diagnostics/DiagnosticsRootCauseClusters.tsx
 */

import type { DiagnosticsFindingCluster } from "./diagnostics-root-cause-clusters.js";
import { StatusBadge } from "../ui/StatusBadge.js";
import { ViewSectionTitle } from "../ui/ViewSectionTitle.js";
import { SEVERITY_LABELS, severityBadgeVariant } from "./diagnostics-severity.js";
import styles from "../../styles/DiagnosticsView.module.css";

interface DiagnosticsRootCauseClustersProps {
  clusters: DiagnosticsFindingCluster[];
  selectedClusterId: string | null;
  onSelectCluster: (clusterId: string | null) => void;
}

function formatConfidence(value: number): string {
  if (!Number.isFinite(value)) return "unbekannt";
  return `${Math.round(value * 100)}%`;
}

export function DiagnosticsRootCauseClusters({
  clusters,
  selectedClusterId,
  onSelectCluster,
}: DiagnosticsRootCauseClustersProps): JSX.Element {
  return (
    <section className={styles.clusterSection} aria-label="Ursachen-Cluster">
      <div className={styles.findingsHeaderRow}>
        <ViewSectionTitle>{`Ursachen (${clusters.length})`}</ViewSectionTitle>
        {selectedClusterId ? (
          <button
            type="button"
            className={styles.clusterClearBtn}
            onClick={() => onSelectCluster(null)}
          >
            Alle Ursachen
          </button>
        ) : null}
      </div>
      {clusters.length === 0 ? (
        <p className={styles.emptyControls}>Keine Ursachen-Cluster.</p>
      ) : (
        <ul className={styles.clusterList}>
          {clusters.map((cluster) => {
            const selected = cluster.id === selectedClusterId;
            const impactParts = [
              `${cluster.findingCount} Finding${cluster.findingCount === 1 ? "" : "s"}`,
              cluster.routeCount > 0
                ? `${cluster.routeCount} Route${cluster.routeCount === 1 ? "" : "n"}`
                : null,
              cluster.componentCount > 0
                ? `${cluster.componentCount} Komponente${cluster.componentCount === 1 ? "" : "n"}`
                : null,
              cluster.domainCount > 0
                ? `${cluster.domainCount} Domain${cluster.domainCount === 1 ? "" : "s"}`
                : null,
            ].filter(Boolean);

            return (
              <li key={cluster.id}>
                <button
                  type="button"
                  className={`${styles.clusterCard}${selected ? ` ${styles.clusterCardSelected}` : ""}`}
                  onClick={() => onSelectCluster(selected ? null : cluster.id)}
                  aria-pressed={selected}
                  data-testid={`root-cause-cluster-${cluster.ruleId}`}
                >
                  <div className={styles.clusterCardTop}>
                    <StatusBadge
                      variant={severityBadgeVariant(cluster.severity)}
                      label={SEVERITY_LABELS[cluster.severity] ?? cluster.severity}
                    />
                    <span className={styles.clusterRule}>{cluster.ruleId}</span>
                    <span className={styles.clusterArea}>{cluster.area}</span>
                  </div>
                  <p className={styles.clusterMessage}>{cluster.messageSample}</p>
                  <div className={styles.clusterMeta}>
                    <span>{impactParts.join(" · ")}</span>
                    <span>
                      Konfidenz Ø {formatConfidence(cluster.averageConfidence)}
                      {cluster.unknownCount > 0 ? ` · ${cluster.unknownCount} unbekannt` : ""}
                    </span>
                  </div>
                  <div className={styles.clusterStates}>
                    <span>
                      erwartet: <code>{cluster.expectedState || "—"}</code>
                    </span>
                    <span>
                      beobachtet: <code>{cluster.actualState || "—"}</code>
                    </span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
