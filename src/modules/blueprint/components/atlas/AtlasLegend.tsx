/**
 * AtlasLegend — v2 semantic kinds plus visual-channel honesty (PR-06).
 * Location: src/modules/blueprint/components/atlas/AtlasLegend.tsx
 */

import { useState } from "react";
import { ATLAS_VISUAL_CHANNELS, formatAtlasLegendEntry } from "./atlas-visual-channels.js";
import styles from "../../styles/AtlasView.module.css";

const LEGEND_ITEMS = [
  { id: "application", label: "Anwendung", kind: "application" },
  { id: "business-domain", label: "Fachdomäne", kind: "domain" },
  { id: "capability", label: "Capability", kind: "module" },
  { id: "service", label: "Service", kind: "service" },
  { id: "technical-module", label: "Techn. Modul", kind: "module" },
  { id: "data-store", label: "Datenspeicher", kind: "table" },
  { id: "external", label: "Extern", kind: "external" },
];

const KNOWLEDGE_LEGEND = [
  { id: "strong", label: "Verifiziert / Gestützt", tone: "strong" },
  { id: "weak", label: "Interpretiert / Unbekannt", tone: "weak" },
  { id: "conflict", label: "Konflikt", tone: "conflict" },
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
          <div className={styles.legendKinds} data-testid="atlas-legend-knowledge">
            {KNOWLEDGE_LEGEND.map((item) => (
              <span
                key={item.id}
                className={styles.knowledgeBadge}
                data-tone={item.tone}
                data-testid="atlas-legend-knowledge-item"
              >
                {item.label}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
