/**
 * Business information overview + flow inspector for Data (PU-11).
 * Location: src/modules/data/components/DataInformationFlowView.tsx
 */

import clsx from "clsx";
import type { InformationFlowCard } from "../../../../shared/product-understanding/index.js";
import {
  atlasKnowledgeStatusLabel,
  atlasKnowledgeTone,
} from "../../blueprint/components/atlas/atlas-knowledge-status.js";
import styles from "../styles/DataPage.module.css";

export interface DataInformationFlowViewProps {
  cards: InformationFlowCard[];
  selectedId: string | null;
  partialReason: string | null;
  onSelect: (cardId: string) => void;
  onOpenSchema: (tableKey: string | null) => void;
}

export function DataInformationFlowView({
  cards,
  selectedId,
  partialReason,
  onSelect,
  onOpenSchema,
}: DataInformationFlowViewProps): JSX.Element {
  const selected = cards.find((card) => card.id === selectedId) ?? null;

  if (cards.length === 0) {
    return (
      <div className={styles.centerState} data-testid="data-info-empty">
        <div className={styles.emptyCard}>
          <p className={styles.emptyHint}>
            Noch keine fachlichen Informationen ableitbar. Schema/ERD bleibt unter „Schema
            (Technik)“ verfügbar.
          </p>
          {partialReason ? <p className={styles.emptyHint}>{partialReason}</p> : null}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.infoLayout} data-testid="data-info-flow">
      {partialReason ? (
        <p className={styles.infoPartial} data-testid="data-info-partial">
          {partialReason}
        </p>
      ) : null}
      <div className={styles.infoGrid}>
        {cards.map((card) => (
          <button
            key={card.id}
            type="button"
            className={clsx(styles.infoCard, selectedId === card.id && styles.infoCardActive)}
            data-testid="data-info-card"
            data-confirmed={card.confirmed ? "true" : "false"}
            aria-pressed={selectedId === card.id}
            onClick={() => onSelect(card.id)}
          >
            <span className={styles.infoCardTitle}>{card.title}</span>
            <span className={styles.infoCardMeaning}>{card.meaning}</span>
            <span data-tone={atlasKnowledgeTone(card.knowledgeStatus)}>
              {atlasKnowledgeStatusLabel(card.knowledgeStatus)}
              {card.confirmed ? "" : " — nicht bestätigt"}
            </span>
          </button>
        ))}
      </div>

      {selected ? (
        <aside
          className={styles.detailPanel}
          role="dialog"
          aria-label={`Information: ${selected.title}`}
          data-testid="data-info-detail"
        >
          <div className={styles.panelHeader}>
            <h2 className={styles.panelTitle}>{selected.title}</h2>
          </div>
          <div className={styles.panelContent}>
            <p className={styles.infoMeaningBody}>{selected.meaning}</p>
            <p className={styles.infoCardMeaning}>
              KnowledgeStatus: {atlasKnowledgeStatusLabel(selected.knowledgeStatus)}
              {selected.confirmed ? "" : " — nicht als bestätigt formulieren"}
            </p>
            {selected.partialReason ? (
              <p className={styles.infoPartial}>{selected.partialReason}</p>
            ) : null}
            <h3 className={styles.infoFlowHeading}>Informationsfluss</h3>
            {selected.hops.length === 0 ? (
              <p className={styles.emptyHint}>Kein belegter Fluss (PARTIAL/UNKNOWN).</p>
            ) : (
              <ol className={styles.infoHopList}>
                {selected.hops.map((hop) => (
                  <li
                    key={hop.id}
                    className={styles.infoHop}
                    data-testid="data-info-hop"
                    data-role={hop.role}
                    data-confirmed={hop.confirmed ? "true" : "false"}
                  >
                    <strong>{hop.label}</strong>
                    <span>
                      {atlasKnowledgeStatusLabel(hop.knowledgeStatus)} · Evidence{" "}
                      {hop.evidenceCount}
                      {hop.confirmed ? "" : " — unbestätigt"}
                    </span>
                  </li>
                ))}
              </ol>
            )}
            <button
              type="button"
              className={styles.primaryButton}
              data-testid="data-open-schema"
              onClick={() => onOpenSchema(selected.storageTableKey)}
            >
              Schema / ERD öffnen
            </button>
          </div>
        </aside>
      ) : null}
    </div>
  );
}
