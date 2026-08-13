/**
 * Metric grid cells for Atlas cluster inspector overview.
 */

import styles from "../../styles/AtlasView.module.css";
import type { ClusterOverviewMetrics } from "./atlas-cluster-overview.js";

export interface AtlasClusterMetricGridProps {
  metrics: ClusterOverviewMetrics;
}

export function AtlasClusterMetricGrid({ metrics }: AtlasClusterMetricGridProps): JSX.Element {
  return (
    <div className={styles.metricGrid} aria-label="Cluster-Metriken">
      <div className={styles.metricCell}>
        <strong>{metrics.services}</strong>
        <span>Services</span>
      </div>
      <div className={styles.metricCell}>
        <strong>{metrics.modules}</strong>
        <span>Module</span>
      </div>
      <div className={styles.metricCell}>
        <strong>{metrics.files}</strong>
        <span>Dateien</span>
      </div>
      <div className={styles.metricCell}>
        <strong>
          {metrics.coveragePercent == null ? "unbekannt" : `${metrics.coveragePercent}%`}
        </strong>
        <span>Abdeckung</span>
      </div>
    </div>
  );
}
