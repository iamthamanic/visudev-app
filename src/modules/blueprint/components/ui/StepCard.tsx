/**
 * Execution pipeline step card for Blueprint Ausführung view.
 * Location: src/modules/blueprint/components/ui/
 */

import type { StatusBadgeVariant } from "./StatusBadge.js";
import { StatusBadge } from "./StatusBadge.js";
import styles from "./StepCard.module.css";

interface StepCardProps {
  stepNumber: number;
  title: string;
  subtitle?: string;
  durationMs?: number | null;
  status?: StatusBadgeVariant;
  selected?: boolean;
  onSelect?: () => void;
  testId?: string;
}

export function StepCard({
  stepNumber,
  title,
  subtitle,
  durationMs,
  status = "confirmed",
  selected = false,
  onSelect,
  testId,
}: StepCardProps): JSX.Element {
  const statusLabel =
    status === "confirmed"
      ? "OK"
      : status === "missing"
        ? "Fehlt"
        : status === "unknown"
          ? "Unbekannt"
          : status;

  return (
    <button
      type="button"
      className={styles.root}
      data-selected={selected ? "true" : "false"}
      data-testid={testId}
      onClick={onSelect}
      aria-pressed={selected}
    >
      <span className={styles.number}>{stepNumber}</span>
      <span className={styles.content}>
        <span className={styles.title}>{title}</span>
        {subtitle ? <span className={styles.subtitle}>{subtitle}</span> : null}
      </span>
      <span className={styles.meta}>
        <span className={styles.duration} data-testid="execution-step-duration">
          {typeof durationMs === "number" && Number.isFinite(durationMs) && durationMs >= 0
            ? `${durationMs}ms`
            : "unbekannt"}
        </span>
        <StatusBadge variant={status} label={statusLabel} />
      </span>
    </button>
  );
}
