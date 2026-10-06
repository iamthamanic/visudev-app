/**
 * Purpose-first Evolution product-history canvas (PU-14).
 * Location: src/modules/blueprint/components/evolution/EvolutionProductHistoryView.tsx
 */

import type {
  EvolutionProductChangeItem,
  EvolutionProductHistoryProjection,
} from "../../../../../shared/product-understanding/index.js";
import styles from "../../styles/EvolutionView.module.css";

export interface EvolutionProductHistoryViewProps {
  projection: EvolutionProductHistoryProjection | null;
  selectedItemId: string | null;
  onSelectItem: (itemId: string | null) => void;
  onOpenTechnik: () => void;
}

function actionTone(action: EvolutionProductChangeItem["action"]): string {
  if (action === "added") return "added";
  if (action === "removed") return "removed";
  return "changed";
}

export function EvolutionProductHistoryView({
  projection,
  selectedItemId,
  onSelectItem,
  onOpenTechnik,
}: EvolutionProductHistoryViewProps): JSX.Element {
  if (!projection) {
    return (
      <div className={styles.productHistoryEmpty} data-testid="evolution-product-history-empty">
        <p>Keine Snapshot-Auswahl für den Produktvergleich.</p>
        <button type="button" className={styles.layerTab} onClick={onOpenTechnik}>
          Technik / Git öffnen
        </button>
      </div>
    );
  }

  if (!projection.comparable) {
    return (
      <div
        className={styles.productHistoryEmpty}
        data-testid="evolution-product-history-incompatible"
        role="status"
      >
        <p>{projection.incompatibleReason}</p>
        <button type="button" className={styles.layerTab} onClick={onOpenTechnik}>
          Commit / Files als Evidence
        </button>
      </div>
    );
  }

  if (projection.identical) {
    return (
      <div className={styles.productHistoryEmpty} data-testid="evolution-product-history-identical">
        <p>Keine semantischen Produktänderungen zwischen den gewählten Snapshots.</p>
        <button type="button" className={styles.layerTab} onClick={onOpenTechnik}>
          Technik / Diff anzeigen
        </button>
      </div>
    );
  }

  const selected =
    projection.previewItems.find((item) => item.id === selectedItemId) ??
    projection.previewItems[0] ??
    null;

  return (
    <div className={styles.productHistoryLayout} data-testid="evolution-product-history">
      {projection.condensed ? (
        <p className={styles.hint} data-testid="evolution-product-history-condensed">
          Große Änderungsmenge — Anzeige auf {projection.previewItems.length} Einträge begrenzt;
          Details per Drill-down.
        </p>
      ) : null}

      <p className={styles.productHistoryTotals} data-testid="evolution-product-history-totals">
        +{projection.totals.added} · −{projection.totals.removed} · ~{projection.totals.changed}
      </p>

      <div className={styles.productHistoryGroups}>
        {projection.groups.map((group) => (
          <section
            key={group.id}
            className={styles.productHistoryGroup}
            data-testid="evolution-product-history-group"
            data-kind={group.changeKind}
            data-action={group.action}
          >
            <h3 className={styles.productHistoryGroupTitle}>{group.title}</h3>
            <ul className={styles.productHistoryList}>
              {group.items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className={styles.productHistoryCard}
                    data-testid="evolution-product-history-item"
                    data-action={item.action}
                    data-selected={selected?.id === item.id ? "true" : "false"}
                    aria-pressed={selected?.id === item.id}
                    onClick={() => onSelectItem(item.id)}
                  >
                    <span
                      className={styles.productHistoryAction}
                      data-tone={actionTone(item.action)}
                    >
                      {item.action}
                    </span>
                    <strong className={styles.productHistoryLabel}>{item.label}</strong>
                    <span className={styles.productHistorySummary}>{item.summary}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {selected ? (
        <aside
          className={styles.productHistoryDetail}
          data-testid="evolution-product-history-detail"
          aria-label={`Änderung: ${selected.label}`}
        >
          <h2 className={styles.productHistoryDetailTitle}>{selected.label}</h2>
          <p>{selected.summary}</p>
          <p className={styles.hint}>
            Evidence:{" "}
            {projection.evidence.baseCommitSha?.slice(0, 8) ?? projection.evidence.baseRef} →{" "}
            {projection.evidence.targetCommitSha?.slice(0, 8) ?? projection.evidence.targetRef}
          </p>
          <button type="button" className={styles.layerTab} onClick={onOpenTechnik}>
            Commit / Files / Graph (Technik)
          </button>
        </aside>
      ) : null}
    </div>
  );
}
