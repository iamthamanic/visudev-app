import { useMemo } from "react";
import type { BlueprintData, BlueprintFinding, CodeFact } from "../../types";
import {
  DIAGNOSTICS_NOTHING_FOUND,
  projectDiagnostics,
  readTabTitle,
  type DiagnosticsProjectionTabId,
} from "./_projection.js";
import styles from "../../styles/DiagnosticsView.module.css";

export interface DiagnosticsProjectionTabProps {
  tab: DiagnosticsProjectionTabId;
  blueprint: BlueprintData;
  findings: BlueprintFinding[];
  facts: CodeFact[];
}

export function DiagnosticsProjectionTab({
  tab,
  blueprint,
  findings,
  facts,
}: DiagnosticsProjectionTabProps): JSX.Element {
  const projection = useMemo(
    () => projectDiagnostics(tab, { blueprint, findings, facts }),
    [tab, blueprint, findings, facts],
  );

  if (projection.rows.length === 0) {
    return (
      <div className={styles.placeholderPanel} data-testid={`diag-tab-${tab}`} role="status">
        <h2 className={styles.placeholderTitle}>{readTabTitle(tab)}</h2>
        <p className={styles.emptyControls}>{DIAGNOSTICS_NOTHING_FOUND[tab]}</p>
      </div>
    );
  }

  return (
    <section
      className={styles.placeholderPanel}
      aria-label={readTabTitle(tab)}
      data-testid={`diag-tab-${tab}`}
    >
      <h2 className={styles.placeholderTitle}>{readTabTitle(tab)}</h2>
      {projection.partial ? (
        <p className={styles.partialNote} role="status">
          Teilweise Daten: {projection.partial}
        </p>
      ) : null}
      <ul className={styles.projectionList}>
        {projection.rows.map((row) => (
          <li key={row.id} className={styles.projectionItem}>
            <span className={styles.projectionLabel}>{row.label}</span>
            {row.detail ? <span className={styles.projectionDetail}>{row.detail}</span> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
