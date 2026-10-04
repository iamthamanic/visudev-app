/**
 * Connection legend — only edge kinds present in the projected infra graph.
 * Location: src/modules/blueprint/components/infrastructure/InfrastructureConnectionLegend.tsx
 */

import styles from "../../styles/InfrastructureView.module.css";

const LEGEND_BY_KIND: Record<string, { label: string; className: string }> = {
  data: { label: "Datenzugriff", className: styles.legendDb },
  contains: { label: "Deployment", className: styles.legendHttp },
  "external-dependency": {
    label: "Externe Verbindung",
    className: styles.legendExternal,
  },
};

interface InfrastructureConnectionLegendProps {
  /** Projected edge kinds currently visible (from infra projection). */
  edgeKinds?: readonly string[];
}

export function InfrastructureConnectionLegend({
  edgeKinds = [],
}: InfrastructureConnectionLegendProps): JSX.Element | null {
  const kinds = [...new Set(edgeKinds)].filter((kind) => LEGEND_BY_KIND[kind]);
  if (kinds.length === 0) return null;

  return (
    <div className={styles.legend} aria-label="Verbindungs-Legende">
      <span className={styles.legendTitle}>Legende (aus Scan)</span>
      <ul className={styles.legendList}>
        {kinds.map((kind) => {
          const item = LEGEND_BY_KIND[kind]!;
          return (
            <li key={kind} className={styles.legendItem}>
              <span className={`${styles.legendSwatch} ${item.className}`} aria-hidden="true" />
              {item.label}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
