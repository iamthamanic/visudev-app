/**
 * Architecture responsibility map — Product Understanding primary canvas (PU-08).
 * Location: src/modules/blueprint/components/architecture/ArchitectureResponsibilityMap.tsx
 */

import type { ArchitectureResponsibilityCard } from "../../../../../shared/product-understanding/index.js";
import styles from "../../styles/ArchitectureView.module.css";

export interface ArchitectureResponsibilityMapProps {
  applications: ArchitectureResponsibilityCard[];
  areas: ArchitectureResponsibilityCard[];
  capabilitiesByArea: Record<string, ArchitectureResponsibilityCard[]>;
  selectedId: string | null;
  partialReason: string | null;
  onSelect: (id: string) => void;
}

export function ArchitectureResponsibilityMap({
  applications,
  areas,
  capabilitiesByArea,
  selectedId,
  partialReason,
  onSelect,
}: ArchitectureResponsibilityMapProps): JSX.Element {
  return (
    <div className={styles.responsibilityMap} data-testid="architecture-responsibility-map">
      {partialReason ? (
        <p className={styles.partialBanner} data-testid="architecture-partial-banner" role="status">
          {partialReason}
        </p>
      ) : null}

      {applications.length > 0 ? (
        <section className={styles.responsibilityApps} aria-label="Applications">
          {applications.map((app) => (
            <button
              key={app.id}
              type="button"
              className={`${styles.responsibilityCard} ${
                selectedId === app.id ? styles.responsibilityCardSelected : ""
              }`}
              data-testid="architecture-responsibility-card"
              data-kind={app.kind}
              data-boundary={app.boundary}
              data-selected={selectedId === app.id ? "true" : "false"}
              onClick={() => onSelect(app.id)}
            >
              <span className={styles.responsibilityKind}>Application</span>
              <strong className={styles.responsibilityTitle}>{app.label}</strong>
              <span className={styles.responsibilityPurpose}>{app.purpose}</span>
            </button>
          ))}
        </section>
      ) : null}

      <section className={styles.responsibilityAreas} aria-label="Produktbereiche">
        {areas.length === 0 ? (
          <p className={styles.filteredCanvasEmpty} data-testid="architecture-responsibility-empty">
            Keine Produktverantwortlichkeiten belegt.
          </p>
        ) : (
          areas.map((area) => {
            const caps = capabilitiesByArea[area.id] ?? [];
            return (
              <article
                key={area.id}
                className={styles.responsibilityArea}
                data-testid="architecture-responsibility-area"
              >
                <button
                  type="button"
                  className={`${styles.responsibilityCard} ${
                    selectedId === area.id ? styles.responsibilityCardSelected : ""
                  }`}
                  data-testid="architecture-responsibility-card"
                  data-kind={area.kind}
                  data-boundary={area.boundary}
                  data-selected={selectedId === area.id ? "true" : "false"}
                  onClick={() => onSelect(area.id)}
                >
                  <span className={styles.responsibilityKind}>Produktbereich</span>
                  <strong className={styles.responsibilityTitle}>{area.label}</strong>
                  <span className={styles.responsibilityPurpose}>{area.purpose}</span>
                  <span
                    className={styles.boundaryBadge}
                    data-testid="architecture-boundary-badge"
                    data-boundary={area.boundary}
                  >
                    {area.boundaryLabel}
                  </span>
                </button>
                {caps.length > 0 ? (
                  <ul className={styles.responsibilityCapList}>
                    {caps.map((cap) => (
                      <li key={cap.id}>
                        <button
                          type="button"
                          className={`${styles.responsibilityCap} ${
                            selectedId === cap.id ? styles.responsibilityCardSelected : ""
                          }`}
                          data-testid="architecture-responsibility-card"
                          data-kind={cap.kind}
                          data-boundary={cap.boundary}
                          data-selected={selectedId === cap.id ? "true" : "false"}
                          onClick={() => onSelect(cap.id)}
                        >
                          <strong>{cap.label}</strong>
                          <span
                            data-testid="architecture-boundary-badge"
                            data-boundary={cap.boundary}
                          >
                            {cap.boundaryLabel}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </article>
            );
          })
        )}
      </section>
    </div>
  );
}
