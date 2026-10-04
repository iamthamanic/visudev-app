/**
 * Shows SemanticSystemModel KnowledgeStatus, confidence, and evidence refs in Atlas Inspektor.
 * Location: src/modules/blueprint/components/atlas/AtlasSemanticEvidenceSection.tsx
 */

import type { SemanticEntity } from "../../../../../shared/semantic-system-model.types.js";
import { formatConfidence } from "../../../../lib/format-confidence.js";
import { atlasKnowledgeStatusLabel, atlasKnowledgeTone } from "./atlas-knowledge-status.js";
import styles from "../../styles/AtlasView.module.css";

export interface AtlasSemanticEvidenceSectionProps {
  entity: SemanticEntity;
}

export function AtlasSemanticEvidenceSection({
  entity,
}: AtlasSemanticEvidenceSectionProps): JSX.Element {
  const tone = atlasKnowledgeTone(entity.knowledgeStatus);
  const confidence = formatConfidence(entity.confidence);

  return (
    <section className={styles.overviewSection} data-testid="atlas-semantic-evidence">
      <h4 className={styles.subSectionTitle}>Semantik</h4>
      <dl className={styles.detailList}>
        <div className={styles.detailRow}>
          <dt>KnowledgeStatus</dt>
          <dd>
            <span
              className={styles.knowledgeBadge}
              data-tone={tone}
              data-status={entity.knowledgeStatus}
              data-testid="atlas-knowledge-status"
            >
              {atlasKnowledgeStatusLabel(entity.knowledgeStatus)}
            </span>
          </dd>
        </div>
        <div className={styles.detailRow}>
          <dt>Confidence</dt>
          <dd data-testid="atlas-confidence">{confidence ?? "unbekannt"}</dd>
        </div>
      </dl>
      {entity.evidence.length > 0 ? (
        <ul className={styles.checklist} data-testid="atlas-evidence-list">
          {entity.evidence.slice(0, 12).map((item) => (
            <li key={`${item.source}:${item.refId}`}>
              {item.source}: {item.refId}
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.emptyControls}>Keine Evidence-Refs.</p>
      )}
    </section>
  );
}
