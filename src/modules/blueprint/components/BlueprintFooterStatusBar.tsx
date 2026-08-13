/**
 * Persistent Blueprint footer with graph counters, health line, and refresh.
 * Location: src/modules/blueprint/components/
 */

import { RefreshCw } from "lucide-react";
import type { BlueprintGraphStats } from "./blueprint-graph-stats.js";
import styles from "../styles/BlueprintFooterStatusBar.module.css";

interface BlueprintFooterStatusBarProps {
  stats: BlueprintGraphStats;
  freshnessLabel: string;
  onRefresh: () => void;
  refreshDisabled?: boolean;
  /** Real count of high/critical findings. Drives the health line (P0-2). */
  criticalCount?: number;
}

function formatCount(value: number): string {
  if (!Number.isFinite(value) || value < 0) return "0";
  return value.toLocaleString("de-DE");
}

export function BlueprintFooterStatusBar({
  stats,
  freshnessLabel,
  onRefresh,
  refreshDisabled = false,
  criticalCount = 0,
}: BlueprintFooterStatusBarProps): JSX.Element {
  const healthLabel =
    criticalCount > 0
      ? `${formatCount(criticalCount)} kritische Probleme`
      : "Keine kritischen Probleme";
  return (
    <footer className={styles.root} data-testid="blueprint-footer-stats">
      <div className={styles.metrics}>
        <span data-testid="footer-module-count">{formatCount(stats.moduleCount)} Module</span>
        <span className={styles.separator}>│</span>
        <span data-testid="footer-file-count">{formatCount(stats.fileCount)} Dateien</span>
        <span className={styles.separator}>│</span>
        <span data-testid="footer-dependency-count">
          {formatCount(stats.dependencyCount)} Abhängigkeiten
        </span>
        <span className={styles.separator}>│</span>
        <span className={styles.healthLine} data-testid="footer-health-line">
          <span className={styles.healthDot} aria-hidden="true" />
          {healthLabel}
        </span>
      </div>

      <div className={styles.actions}>
        <span className={styles.freshness}>Aktualisiert {freshnessLabel}</span>
        <button
          type="button"
          className={styles.refreshButton}
          onClick={onRefresh}
          disabled={refreshDisabled}
          aria-label="Blueprint-Daten aktualisieren"
        >
          <RefreshCw className={styles.icon} aria-hidden="true" />
        </button>
      </div>
    </footer>
  );
}
