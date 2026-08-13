/**
 * Left controls for DependenciesView — Beziehungstypen chips, Isolierte-Knoten toggle, Top-Abhängigkeiten.
 */

import { ViewSectionTitle } from "../ui/ViewSectionTitle.js";
import { RelationshipChip } from "../ui/RelationshipChip.js";
import { RELATIONSHIP_KINDS, type RelationshipKind } from "../ui/blueprint-relationship-tokens.js";
import { RELATIONSHIP_LABELS, type DependencyEdgeKind } from "./_projection.constants.js";
import { ControlHint } from "../../../../components/ui/ControlHint.js";
import styles from "../../styles/DependenciesView.module.css";

export interface TopDependencyCount {
  kind: DependencyEdgeKind;
  count: number;
}

export interface DependenciesControlsProps {
  visibleEdgeKinds: Set<DependencyEdgeKind>;
  topDependencies: TopDependencyCount[];
  showOrphans: boolean;
  orphanCount: number;
  onToggleEdgeKind: (kind: DependencyEdgeKind) => void;
  onToggleOrphans: () => void;
  onResetFilters: () => void;
}

export function DependenciesControls({
  visibleEdgeKinds,
  topDependencies,
  showOrphans,
  orphanCount,
  onToggleEdgeKind,
  onToggleOrphans,
  onResetFilters,
}: DependenciesControlsProps): JSX.Element {
  const sortedTop = [...topDependencies].sort((a, b) => b.count - a.count);
  const presentKinds = new Set(topDependencies.map((entry) => entry.kind));

  return (
    <aside className={styles.controls} aria-label="Abhängigkeiten-Steuerung">
      <section className={styles.section}>
        <ViewSectionTitle>Beziehungstypen</ViewSectionTitle>
        <div className={styles.chipGrid}>
          {RELATIONSHIP_KINDS.map((kind) => {
            const edgeKind = kind as DependencyEdgeKind;
            const available = presentKinds.has(edgeKind);
            const label = RELATIONSHIP_LABELS[edgeKind];
            const chip = (
              <span data-testid={`dep-chip-${edgeKind}`}>
                <RelationshipChip
                  kind={kind as RelationshipKind}
                  active={available && visibleEdgeKinds.has(edgeKind)}
                  disabled={!available}
                  onToggle={() => onToggleEdgeKind(edgeKind)}
                />
              </span>
            );
            if (available) return <span key={kind}>{chip}</span>;
            return (
              <ControlHint key={kind} reason={`Keine ${label}-Kanten im aktuellen Scan.`}>
                {chip}
              </ControlHint>
            );
          })}
        </div>
        <button
          type="button"
          className={`btn btn-sm btn-ghost ${styles.resetButton}`}
          onClick={onResetFilters}
        >
          Filter zurücksetzen
        </button>
      </section>

      <section className={styles.section}>
        <ViewSectionTitle>Isolierte Knoten</ViewSectionTitle>
        <label className={styles.orphanToggle}>
          <input
            type="checkbox"
            className="toggle toggle-sm"
            checked={showOrphans}
            onChange={onToggleOrphans}
            data-testid="dep-filter-orphans"
          />
          <span>
            Isolierte Knoten
            {orphanCount > 0 ? ` (${orphanCount})` : ""}
          </span>
        </label>
      </section>

      <section className={styles.section}>
        <ViewSectionTitle>Top Abhängigkeiten</ViewSectionTitle>
        {sortedTop.length === 0 ? (
          <p className={styles.emptyControls}>Keine Abhängigkeits-Kanten im Graph.</p>
        ) : (
          <ul className={styles.topDepsList}>
            {sortedTop.map(({ kind, count }) => (
              <li key={kind} className={styles.topDepsItem}>
                <span className={styles.topDepsKind} data-kind={kind}>
                  {RELATIONSHIP_LABELS[kind]}
                </span>
                <span className={styles.topDepsCount}>{count}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </aside>
  );
}
