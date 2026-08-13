/**
 * Toggle chip for Blueprint relationship / edge kind filters (Figma Beziehungstypen).
 * Location: src/modules/blueprint/components/ui/
 */

import type { CSSProperties } from "react";
import { Check } from "lucide-react";
import {
  RELATIONSHIP_CSS_VARS,
  RELATIONSHIP_LABELS,
  RELATIONSHIP_SOFT_CSS_VARS,
  type RelationshipKind,
} from "./blueprint-relationship-tokens.js";
import styles from "./RelationshipChip.module.css";

interface RelationshipChipProps {
  kind: RelationshipKind;
  active: boolean;
  onToggle: () => void;
  /** Honest-Core P0-3: chip is inert when the current graph has no edges of this kind. */
  disabled?: boolean;
}

export function RelationshipChip({
  kind,
  active,
  onToggle,
  disabled = false,
}: RelationshipChipProps): JSX.Element {
  const accent = RELATIONSHIP_CSS_VARS[kind];
  const soft = RELATIONSHIP_SOFT_CSS_VARS[kind];

  return (
    <button
      type="button"
      className={styles.root}
      data-testid="relationship-chip"
      data-dep-chip={kind}
      data-relationship-kind={kind}
      data-active={!disabled && active ? "true" : "false"}
      data-disabled={disabled ? "true" : "false"}
      disabled={disabled}
      aria-disabled={disabled}
      style={
        {
          "--chip-accent": accent,
          "--chip-soft": soft,
        } as CSSProperties
      }
      aria-pressed={!disabled && active}
      onClick={disabled ? undefined : onToggle}
    >
      <span className={styles.dot} aria-hidden="true" />
      <span className={styles.label}>{RELATIONSHIP_LABELS[kind]}</span>
      {active ? <Check className={styles.check} aria-hidden="true" /> : null}
    </button>
  );
}
