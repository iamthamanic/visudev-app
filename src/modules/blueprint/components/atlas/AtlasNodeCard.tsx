/**
 * Floating node label card for Atlas controls — purpose-first product concepts (PU-07).
 */

import type { GraphCanvasNode } from "../../types";
import { atlasKindLabel } from "./atlas-display.js";
import { atlasKnowledgeStatusLabel, atlasKnowledgeTone } from "./atlas-knowledge-status.js";
import styles from "../../styles/AtlasView.module.css";

export interface AtlasNodeCardProps {
  node: GraphCanvasNode;
  selected: boolean;
  onSelect: () => void;
}

export function AtlasNodeCard({ node, selected, onSelect }: AtlasNodeCardProps): JSX.Element {
  const kindLabel = atlasKindLabel(node.productKind ?? node.semanticKind ?? node.kind);
  const tone = atlasKnowledgeTone(node.knowledgeStatus);
  const purpose = node.purpose?.trim();
  return (
    <button
      type="button"
      className={styles.nodeCard}
      data-selected={selected ? "true" : "false"}
      data-kind={node.kind}
      data-semantic-kind={node.semanticKind ?? ""}
      data-product-kind={node.productKind ?? ""}
      data-knowledge-tone={tone}
      aria-pressed={selected}
      onClick={onSelect}
    >
      <span className={styles.nodeCardLabel}>{node.label}</span>
      {purpose ? <span className={styles.nodeCardPurpose}>{purpose}</span> : null}
      <span className={styles.nodeCardMeta}>
        {kindLabel}
        {node.knowledgeStatus ? (
          <>
            {" · "}
            <span className={styles.knowledgeInline} data-tone={tone}>
              {atlasKnowledgeStatusLabel(node.knowledgeStatus)}
            </span>
          </>
        ) : null}
      </span>
    </button>
  );
}
