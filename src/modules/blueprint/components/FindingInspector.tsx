/**
 * FindingInspector — Evidence-Sidebar für Blueprint Findings.
 * Location: src/modules/blueprint/components/FindingInspector.tsx
 */

import type { BlueprintFinding, CodeFact } from "../types";
import { formatConfidence } from "../../../lib/format-confidence.js";
import styles from "../styles/FindingInspector.module.css";

interface FindingInspectorProps {
  findings: BlueprintFinding[];
  facts: CodeFact[];
  selectedFindingId: string | null;
  onSelectFinding: (id: string | null) => void;
}

export function FindingInspector({
  findings,
  facts,
  selectedFindingId,
  onSelectFinding,
}: FindingInspectorProps) {
  const selected = findings.find((f) => f.id === selectedFindingId) ?? null;
  const factMap = new Map(facts.map((f) => [f.id, f]));

  return (
    <aside className={styles.root} aria-labelledby="finding-inspector-title">
      <h2 id="finding-inspector-title" className={styles.title}>
        Findings
      </h2>
      {findings.length === 0 ? (
        <p className={styles.empty}>Keine Findings für diese Auswahl.</p>
      ) : (
        <ul className={styles.list}>
          {findings.map((f) => (
            <li key={f.id}>
              <button
                type="button"
                className={f.id === selectedFindingId ? styles.itemSelected : styles.item}
                onClick={() => onSelectFinding(f.id === selectedFindingId ? null : f.id)}
              >
                <span className={severityClass(f.severity)}>{f.severity}</span>
                <span className={styles.itemMessage}>{f.message}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {selected && (
        <div className={styles.detail}>
          <h3 className={styles.detailTitle}>Inspector</h3>
          <dl className={styles.dl}>
            <dt>Rule</dt>
            <dd>
              <code>{selected.ruleId}</code>
            </dd>
            <dt>Erwartet</dt>
            <dd>{selected.expectedState}</dd>
            <dt>Gefunden</dt>
            <dd>{selected.actualState}</dd>
            <dt>Confidence</dt>
            <dd>{formatConfidence(selected.confidence) ?? "unbekannt"}</dd>
            {selected.remediation && (
              <>
                <dt>Lösung</dt>
                <dd>{selected.remediation}</dd>
              </>
            )}
          </dl>
          <h4 className={styles.evidenceTitle}>Evidence</h4>
          <ul className={styles.evidenceList}>
            {selected.evidenceFactIds.map((id) => {
              const fact = factMap.get(id);
              if (!fact) return null;
              return (
                <li key={id} className={styles.evidenceItem}>
                  <code>
                    {fact.filePath}:{fact.line}
                  </code>
                  <pre className={styles.snippet}>{fact.snippet}</pre>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </aside>
  );
}

function severityClass(severity: BlueprintFinding["severity"]): string {
  if (severity === "high" || severity === "critical") return styles.sevHigh;
  if (severity === "medium") return styles.sevMedium;
  return styles.sevLow;
}
