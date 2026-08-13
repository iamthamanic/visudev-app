/**
 * One AccessControlFinding detail block for the inspector body.
 */

import type { AccessControlFinding } from "../../../../lib/visudev/access-control-types";
import { formatConfidence } from "../../../../lib/format-confidence.js";
import { StatusBadge } from "../ui/StatusBadge.js";
import { accessControlStatusBadge } from "./access-control-inspector-status.js";
import styles from "../../styles/AccessControlInspector.module.css";

function asList<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

interface AccessControlFindingDetailProps {
  finding: AccessControlFinding;
  showIndex: boolean;
  index: number;
}

export function AccessControlFindingDetail({
  finding,
  showIndex,
  index,
}: AccessControlFindingDetailProps): JSX.Element {
  const badge = accessControlStatusBadge(finding.status);
  const mechanisms = asList(finding.mechanisms);
  const layers = asList(finding.enforcementLayers);
  const evidence = asList(finding.evidence);

  return (
    <>
      <section className={styles.detailSection}>
        <h3 className={styles.detailTitle}>{showIndex ? `Finding ${index + 1}` : "Status"}</h3>
        <div className={styles.block}>
          <StatusBadge variant={badge.variant} label={badge.label} />
          <p className={styles.meta}>
            Confidence {formatConfidence(finding.confidence) ?? "unbekannt"}
            {" · "}
            {finding.resourceKind}
            {finding.ruleId ? ` · ${finding.ruleId}` : ""}
          </p>
          {finding.warning ? (
            <p className={styles.warning} data-testid="ac-bypass-warning">
              Bypass-Hinweis: {finding.warning}
            </p>
          ) : null}
        </div>
      </section>

      <section className={styles.detailSection}>
        <h3 className={styles.detailTitle}>Mechanismen</h3>
        {mechanisms.length === 0 ? (
          <p className={styles.empty}>Keine Mechanismen erkannt.</p>
        ) : (
          <ul className={styles.list} data-testid="ac-mechanisms">
            {mechanisms.map((mechanism) => (
              <li key={`${finding.id}-${mechanism.kind}-${mechanism.label}`}>
                <span className={styles.mechanismLabel}>{mechanism.label}</span>
                <span className={styles.mechanismKind}>{mechanism.kind}</span>
                {mechanism.technology ? (
                  <span className={styles.mechanismTech}>{mechanism.technology}</span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.detailSection}>
        <h3 className={styles.detailTitle}>Enforcement Layers</h3>
        {layers.length === 0 ? (
          <p className={styles.empty}>Keine Layer ausgewiesen.</p>
        ) : (
          <ul className={styles.chips} data-testid="ac-enforcement-layers">
            {layers.map((layer) => (
              <li key={`${finding.id}-${layer}`}>{layer}</li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.detailSection}>
        <h3 className={styles.detailTitle}>Evidence</h3>
        {evidence.length === 0 ? (
          <p className={styles.empty}>Keine Evidence.</p>
        ) : (
          <ul className={styles.evidenceList} data-testid="ac-evidence">
            {evidence.map((item) => (
              <li key={item.id}>
                <code className={styles.evidencePath}>
                  {item.filePath}:{item.line}
                </code>
                <pre className={styles.evidenceExcerpt}>{item.excerpt}</pre>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
