/**
 * Execution mode badge — "Live" only with a real running telemetry channel,
 * otherwise "Projektion" (Honest-Core P0-4).
 */

import { StatusBadge } from "../ui/StatusBadge.js";
import styles from "../../styles/ExecutionView.module.css";

export interface ExecutionLiveBadgeProps {
  live: boolean;
}

export function ExecutionLiveBadge({ live }: ExecutionLiveBadgeProps): JSX.Element {
  return (
    <span
      className={styles.liveBadgeWrap}
      data-testid="execution-mode-badge"
      data-live={live ? "true" : "false"}
    >
      {live ? (
        <>
          <span className={styles.liveSignal} aria-hidden="true">
            ●
          </span>
          <StatusBadge variant="running" label="Live" />
        </>
      ) : (
        <StatusBadge variant="unknown" label="Projektion" />
      )}
    </span>
  );
}
