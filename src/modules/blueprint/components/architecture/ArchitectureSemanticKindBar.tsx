/**
 * Shows SemanticSystemModel v2 kind counts for Architecture (PR-07).
 * Location: src/modules/blueprint/components/architecture/ArchitectureSemanticKindBar.tsx
 */

import type { ArchitectureSemanticKindSummary } from "./build-layer-stack.js";
import styles from "../../styles/ArchitectureView.module.css";

export interface ArchitectureSemanticKindBarProps {
  summaries: ArchitectureSemanticKindSummary[];
}

export function ArchitectureSemanticKindBar({
  summaries,
}: ArchitectureSemanticKindBarProps): JSX.Element | null {
  if (summaries.length === 0) return null;
  return (
    <ul
      className={styles.semanticKindBar}
      aria-label="Semantische Schichten"
      data-testid="architecture-semantic-kinds"
    >
      {summaries.map((entry) => (
        <li key={entry.kind} data-kind={entry.kind} data-testid="architecture-semantic-kind">
          <span>{entry.label}</span>
          <strong>{entry.count}</strong>
        </li>
      ))}
    </ul>
  );
}
