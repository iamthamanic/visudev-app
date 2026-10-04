/**
 * Timeline ruler — measured endMs only; hide synthetic 0ms when no telemetry (PR-09).
 */

import type { StepTiming } from "./_projection.js";
import styles from "../../styles/ExecutionView.module.css";

export interface ExecutionTimelineRulerProps {
  stepTimings: StepTiming[];
}

export function ExecutionTimelineRuler({
  stepTimings,
}: ExecutionTimelineRulerProps): JSX.Element | null {
  if (stepTimings.length === 0) return null;

  const measured = stepTimings.filter((timing) => timing.hasMeasuredTiming);
  if (measured.length === 0) {
    return (
      <div className={styles.timelineWrap} aria-label="Zeitachse" data-testid="execution-timeline">
        <p className={styles.timelineTotal}>Gesamt: nicht gemessen</p>
      </div>
    );
  }

  const totalMs = Math.max(...measured.map((timing) => timing.endMs ?? 0));

  return (
    <div className={styles.timelineWrap} aria-label="Zeitachse" data-testid="execution-timeline">
      <div className={styles.timelineTrack}>
        {stepTimings.map((timing, index) => (
          <div key={timing.nodeId} className={styles.timelineSegment}>
            {index > 0 ? <span className={styles.timelineTick} aria-hidden="true" /> : null}
            <span className={styles.timelineLabel}>
              {timing.hasMeasuredTiming && timing.endMs != null ? `${timing.endMs}ms` : "—"}
            </span>
          </div>
        ))}
      </div>
      <p className={styles.timelineTotal}>Gesamt: {totalMs}ms</p>
    </div>
  );
}
