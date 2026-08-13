/**
 * AtlasStatsBar — Systeme/Services/Module/Dateien/Abdeckung counters above the atlas canvas.
 * Honest-Core (P0-1): Abdeckung shows "unbekannt" when coveragePercent is null.
 */

import type { AtlasAggregateStats } from "./atlas-stats.js";
import styles from "../../styles/AtlasView.module.css";

export interface AtlasStatsBarProps {
  stats: AtlasAggregateStats;
}

export function AtlasStatsBar({ stats }: AtlasStatsBarProps): JSX.Element {
  const items: Array<{ key: string; label: string; value: string }> = [
    { key: "systems", label: "Systeme", value: String(stats.systems) },
    { key: "services", label: "Services", value: String(stats.services) },
    { key: "modules", label: "Module", value: String(stats.modules) },
    { key: "files", label: "Dateien", value: String(stats.files) },
    {
      key: "coverage",
      label: "Abdeckung",
      value: stats.coveragePercent == null ? "unbekannt" : `${stats.coveragePercent}%`,
    },
  ];

  return (
    <div className={styles.statsBar} aria-label="Atlas-Statistik" data-testid="atlas-stats-bar">
      {items.map((item, index) => (
        <span key={item.key} className={styles.statsItem} data-testid={`atlas-stat-${item.key}`}>
          {index > 0 ? (
            <span className={styles.statsDivider} aria-hidden="true">
              ·
            </span>
          ) : null}
          {item.label}: {item.value}
        </span>
      ))}
    </div>
  );
}
