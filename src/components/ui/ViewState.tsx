/**
 * ViewState — five honest empty states for Blueprint views (Honest-Core P1-4).
 * Location: src/components/ui/ViewState.tsx
 */

import styles from "./ViewState.module.css";

export const VIEW_STATE_NAMES = [
  "loading",
  "error",
  "not-scanned",
  "nothing-found",
  "partial-scan",
] as const;

export type ViewStateName = (typeof VIEW_STATE_NAMES)[number];

export interface ViewStateProps {
  name: ViewStateName;
  title: string;
  detail: string;
  onRetry?: () => void;
  retryLabel?: string;
}

export function ViewState({
  name,
  title,
  detail,
  onRetry,
  retryLabel = "Erneut analysieren",
}: ViewStateProps): JSX.Element {
  return (
    <div className={styles.root} role="status" data-testid={`view-state-${name}`}>
      <p className={styles.title}>{title}</p>
      <p className={styles.detail}>{detail}</p>
      {name === "error" && onRetry ? (
        <button
          type="button"
          className={`btn btn-sm btn-primary ${styles.retry}`}
          onClick={onRetry}
        >
          {retryLabel}
        </button>
      ) : null}
    </div>
  );
}
