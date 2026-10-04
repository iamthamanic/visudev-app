/**
 * Activity list for Atlas cluster inspector overview.
 */

import styles from "../../styles/AtlasView.module.css";
import type { ClusterActivityItem } from "./atlas-cluster-overview.js";

export interface AtlasClusterActivityListProps {
  items: ClusterActivityItem[];
}

export function AtlasClusterActivityList({ items }: AtlasClusterActivityListProps): JSX.Element {
  return (
    <section className={styles.overviewSection} data-testid="atlas-inspector-activity">
      <h4 className={styles.subSectionTitle}>Aktivität</h4>
      <ul className={styles.activityList}>
        {items.map((item, index) => (
          <li key={item.id || `activity:${index}`} data-testid="atlas-activity-item">
            <span>{item.label}</span>
            <span className={styles.activityWhen}>{item.when}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
