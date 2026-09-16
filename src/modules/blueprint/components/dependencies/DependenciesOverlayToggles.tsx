/**
 * Overlay preset toggles for Dependencies — Security / API / Events filters.
 * Location: src/modules/blueprint/components/dependencies/DependenciesOverlayToggles.tsx
 *
 * Filters existing graph kinds only; never invents nodes.
 * Collapsed by default (Hick): one summary control, expand for presets.
 */

import { useState } from "react";
import {
  OVERLAY_LABELS,
  type DependencyOverlayId,
} from "./dependencies-overlay.js";
import styles from "../../styles/DependenciesView.module.css";

export type { DependencyOverlayId };

export interface DependenciesOverlayTogglesProps {
  activeOverlays: Set<DependencyOverlayId>;
  onToggle: (overlay: DependencyOverlayId) => void;
}

export function DependenciesOverlayToggles({
  activeOverlays,
  onToggle,
}: DependenciesOverlayTogglesProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const activeCount = activeOverlays.size;
  const summary =
    activeCount === 0
      ? "Overlays (keine)"
      : `Overlays (${activeCount} aktiv)`;

  return (
    <section className={styles.section} data-testid="dep-overlays">
      <details
        open={open}
        onToggle={(event) => setOpen((event.target as HTMLDetailsElement).open)}
      >
        <summary className={styles.orphanToggle} data-testid="dep-overlays-summary">
          {summary}
        </summary>
        <p className={styles.emptyControls}>
          Schnellfilter auf vorhandene Kantentypen — keine neuen Knoten.
        </p>
        <div className={styles.chipGrid}>
          {(Object.keys(OVERLAY_LABELS) as DependencyOverlayId[]).map((overlay) => (
            <label key={overlay} className={styles.orphanToggle}>
              <input
                type="checkbox"
                className="toggle toggle-sm"
                checked={activeOverlays.has(overlay)}
                onChange={() => onToggle(overlay)}
                data-testid={`dep-overlay-${overlay}`}
              />
              <span>{OVERLAY_LABELS[overlay]}</span>
            </label>
          ))}
        </div>
      </details>
    </section>
  );
}
