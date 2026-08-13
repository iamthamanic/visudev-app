/**
 * AtlasLegend — visual-channel semantics plus cluster kind colors (Honest-Core P1-6).
 * Location: src/modules/blueprint/components/atlas/AtlasLegend.tsx
 */

import { useState } from "react";
import { ATLAS_VISUAL_CHANNELS, formatAtlasLegendEntry } from "./atlas-visual-channels.js";
import styles from "../../styles/AtlasView.module.css";

const LEGEND_ITEMS = [
  { id: "frontend", label: "Frontend", kind: "module" },
  { id: "backend", label: "Backend", kind: "service" },
  { id: "worker", label: "Worker", kind: "worker" },
  { id: "data", label: "Daten", kind: "table" },
  { id: "storage", label: "Speicher", kind: "storage" },
  { id: "external", label: "Externe", kind: "external" },
  { id: "security", label: "Sicherheit", kind: "security" },
];

export function AtlasLegend(): JSX.Element {
  const [open, setOpen] = useState(true);

  return (
    <div className={styles.legendDock}>
      <button
        type="button"
        className={`btn btn-sm btn-ghost ${styles.legendToggle}`}
        aria-expanded={open}
        aria-controls="atlas-legend-body"
        onClick={() => setOpen((current) => !current)}
      >
        {open ? "Legende ausblenden" : "Legende einblenden"}
      </button>
      {open ? (
        <div
          id="atlas-legend-body"
          className={styles.legend}
          aria-label="Atlas-Legende"
          data-testid="atlas-legend"
        >
          <ul className={styles.legendChannels}>
            {ATLAS_VISUAL_CHANNELS.map((channel) => (
              <li
                key={channel.id}
                className={styles.legendChannel}
                data-testid="atlas-legend-channel"
                data-source={channel.source}
              >
                {formatAtlasLegendEntry(channel)}
              </li>
            ))}
          </ul>
          <div className={styles.legendKinds}>
            {LEGEND_ITEMS.map((item) => (
              <span
                key={item.id}
                className={styles.legendItem}
                data-kind={item.kind}
                data-testid="atlas-legend-item"
              >
                <span className={styles.legendDot} aria-hidden="true" />
                {item.label}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
