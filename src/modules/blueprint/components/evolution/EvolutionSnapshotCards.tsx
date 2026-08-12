/**
 * Horizontal snapshot selector cards with mini cyber-city thumbnail hints (Wave 5).
 */

import { Check } from "lucide-react";
import type { SoftwareGraphSnapshot } from "../../types";
import { ViewSectionTitle } from "../ui/ViewSectionTitle.js";
import {
  formatSnapshotDate,
  formatSnapshotOrigin,
  snapshotOriginHelp,
} from "./evolution-display.js";
import styles from "../../styles/EvolutionView.module.css";

interface EvolutionSnapshotCardsProps {
  snapshots: SoftwareGraphSnapshot[];
  baseSnapshotId: string | null;
  targetSnapshotId: string | null;
  onSelectBase: (snapshotId: string) => void;
  onSelectTarget: (snapshotId: string) => void;
}

function SnapshotThumb({ seed }: { seed: number }): JSX.Element {
  const heights = [0, 1, 2, 3, 4, 5].map((index) => 1 + ((seed + index * 3) % 4));

  return (
    <span
      className={styles.snapshotThumbnail}
      data-testid="evolution-snapshot-thumb"
      aria-hidden="true"
    >
      <span className={styles.snapshotThumbGrid}>
        {heights.map((height, index) => (
          <span
            key={index}
            className={styles.snapshotThumbBlock}
            data-level={String(height)}
            data-tone={String((seed + index) % 4)}
          />
        ))}
      </span>
    </span>
  );
}

export function EvolutionSnapshotCards({
  snapshots,
  baseSnapshotId,
  targetSnapshotId,
  onSelectTarget,
}: EvolutionSnapshotCardsProps): JSX.Element {
  return (
    <section className={styles.snapshotRow} aria-label="Snapshot-Auswahl">
      <ViewSectionTitle>Atlas Snapshots</ViewSectionTitle>
      {snapshots.length === 0 ? (
        <p className={styles.emptyControls}>Keine Snapshots vorhanden.</p>
      ) : (
        <ul className={styles.snapshotList}>
          {snapshots.map((snapshot, index) => {
            const isTarget = snapshot.id === targetSnapshotId;
            const isBase = snapshot.id === baseSnapshotId;
            const originLabel = formatSnapshotOrigin(snapshot);
            return (
              <li key={snapshot.id}>
                <button
                  type="button"
                  className={`${styles.snapshotCard} ${isTarget ? styles.snapshotCardSelected : ""}`}
                  aria-pressed={isTarget}
                  data-testid="evolution-snapshot-card"
                  onClick={() => onSelectTarget(snapshot.id)}
                >
                  <SnapshotThumb seed={index * 13 + snapshot.nodeIds.length} />
                  <span className={styles.snapshotCardHeader}>
                    <span className={styles.snapshotLabel} title={snapshotOriginHelp(snapshot)}>
                      {originLabel}
                    </span>
                    {isTarget ? (
                      <Check className={styles.snapshotCheck} aria-hidden="true" />
                    ) : null}
                  </span>
                  <span className={styles.snapshotMeta}>
                    {formatSnapshotDate(snapshot.capturedAt)}
                  </span>
                  {isBase ? <span className={styles.snapshotBadge}>Basis</span> : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
