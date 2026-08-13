/**
 * TruncationBanner — honest partial-scan notice (Honest-Core P0-1).
 * Shown when the analysis was cut short (file limit / node budget). Never an
 * error color; dimmed informational state with role=status for screen readers.
 */

import styles from "./TruncationBanner.module.css";

export interface TruncationBannerProps {
  /** Files actually analyzed. */
  analyzed: number;
  /** Total files in the repo, when known. */
  total?: number | null;
}

export function TruncationBanner({ analyzed, total }: TruncationBannerProps): JSX.Element {
  const scope =
    typeof total === "number" && Number.isFinite(total) && total > 0
      ? `${analyzed} von ${total} Dateien`
      : `${analyzed} Dateien`;

  return (
    <div className={styles.banner} role="status" aria-live="polite" data-testid="truncation-banner">
      <p className={styles.title}>Analyse unvollständig</p>
      <p className={styles.text}>
        {scope} analysiert — die Analyse wurde am Datei-/Knoten-Limit abgeschnitten. Erhöhe den
        Umfang für ein vollständiges Bild.
      </p>
    </div>
  );
}
