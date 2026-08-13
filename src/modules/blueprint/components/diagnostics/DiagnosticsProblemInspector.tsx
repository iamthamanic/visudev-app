/**
 * Problem-Inspektor for selected finding — severity, SQL evidence, linked artifacts, actions.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import type { BlueprintFinding, CodeFact, RouteBlueprint, SecurityMatrixRow } from "../../types";
import { InspectorPanel } from "../ui/InspectorPanel.js";
import { StatusBadge } from "../ui/StatusBadge.js";
import { SEVERITY_LABELS, severityBadgeVariant } from "./diagnostics-severity.js";
import {
  isSqlEvidence,
  matrixLocationLabel,
  primaryEvidenceFact,
} from "./diagnostics-finding-location.js";
import type { FindingResolutionStatus } from "./finding-resolution.js";
import { formatConfidence } from "../../../../lib/format-confidence.js";
import { MetricHint } from "../../../../components/ui/MetricHint.js";
import styles from "../../styles/DiagnosticsView.module.css";

interface DiagnosticsProblemInspectorProps {
  finding: BlueprintFinding | null;
  facts: CodeFact[];
  route: RouteBlueprint | null;
  matrixRow: SecurityMatrixRow | null;
  resolutionStatus?: FindingResolutionStatus;
  onToggleResolved?: () => void;
}

export function DiagnosticsProblemInspector({
  finding,
  facts,
  route,
  matrixRow,
  resolutionStatus = "open",
  onToggleResolved,
}: DiagnosticsProblemInspectorProps): JSX.Element {
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">("idle");
  const copyResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyResetRef.current) clearTimeout(copyResetRef.current);
    };
  }, []);

  const evidenceFacts = useMemo(() => {
    if (!finding) return [];
    const factMap = new Map(facts.map((fact) => [fact.id, fact]));
    return finding.evidenceFactIds
      .map((id) => factMap.get(id))
      .filter((fact): fact is CodeFact => fact != null);
  }, [facts, finding]);

  if (!finding) {
    return (
      <InspectorPanel
        title="Keine Auswahl"
        emptyMessage="Wähle ein Finding, um Details und Evidence zu sehen."
      />
    );
  }

  const primaryEvidence = primaryEvidenceFact(finding, facts);
  const matrixLabel = matrixLocationLabel(matrixRow);
  const evidenceText = evidenceFacts.map((fact) => fact.snippet).join("\n\n");

  const handleCopyEvidence = async () => {
    if (!evidenceText) return;
    try {
      await navigator.clipboard.writeText(evidenceText);
      setCopyStatus("copied");
      if (copyResetRef.current) clearTimeout(copyResetRef.current);
      copyResetRef.current = setTimeout(() => setCopyStatus("idle"), 2000);
    } catch {
      setCopyStatus("error");
      if (copyResetRef.current) clearTimeout(copyResetRef.current);
      copyResetRef.current = setTimeout(() => setCopyStatus("idle"), 2000);
    }
  };

  return (
    <InspectorPanel
      title={finding.message}
      subtitle={finding.ruleId}
      badges={
        <StatusBadge
          variant={severityBadgeVariant(finding.severity)}
          label={SEVERITY_LABELS[finding.severity]}
        />
      }
      sections={[
        {
          id: "artifacts",
          title: "Verknüpfte Artefakte",
          content: (
            <ul className={styles.artifactList}>
              {route ? (
                <li>
                  <span className={styles.artifactLabel}>Route</span>
                  <a className={styles.artifactLink} href={`#route-${route.id}`}>
                    {route.method} {route.path}
                  </a>
                </li>
              ) : null}
              {primaryEvidence ? (
                <li>
                  <span className={styles.artifactLabel}>Datei</span>
                  <a
                    className={styles.artifactLink}
                    href={`#file-${primaryEvidence.filePath}-${primaryEvidence.line}`}
                  >
                    {primaryEvidence.filePath}:{primaryEvidence.line}
                  </a>
                </li>
              ) : null}
              {matrixLabel ? (
                <li>
                  <span className={styles.artifactLabel}>Matrix</span>
                  <span className={styles.artifactMeta}>{matrixLabel}</span>
                </li>
              ) : null}
              {!route && !primaryEvidence && !matrixLabel ? (
                <li className={styles.emptyControls}>Keine Artefakte verknüpft.</li>
              ) : null}
            </ul>
          ),
        },
        {
          id: "details",
          title: "Details",
          content: (
            <dl className={styles.detailList}>
              <div className={styles.detailRow}>
                <dt>Erwartet</dt>
                <dd>{finding.expectedState}</dd>
              </div>
              <div className={styles.detailRow}>
                <dt>Gefunden</dt>
                <dd>{finding.actualState}</dd>
              </div>
              <div className={styles.detailRow}>
                <dt>Confidence</dt>
                <dd>
                  <MetricHint
                    glossaryId="confidence"
                    source={formatConfidence(finding.confidence) == null ? "unbekannt" : "graph"}
                  >
                    {formatConfidence(finding.confidence) ?? "unbekannt"}
                  </MetricHint>
                </dd>
              </div>
              {finding.remediation ? (
                <div className={styles.detailRow}>
                  <dt>Lösung</dt>
                  <dd>{finding.remediation}</dd>
                </div>
              ) : null}
            </dl>
          ),
        },
        {
          id: "evidence",
          title: "SQL / Evidence",
          content:
            evidenceFacts.length === 0 ? (
              <p className={styles.emptyControls}>Keine Evidence verknüpft.</p>
            ) : (
              <div className={styles.evidenceStack} data-testid="problem-inspector-evidence">
                {evidenceFacts.map((fact) => (
                  <div key={fact.id} className={styles.evidenceItem}>
                    <p className={styles.evidenceMeta}>
                      {fact.filePath}:{fact.line}
                    </p>
                    <pre
                      className={
                        isSqlEvidence(fact) ? styles.evidenceSqlBlock : styles.evidenceCodeBlock
                      }
                    >
                      {fact.snippet}
                    </pre>
                  </div>
                ))}
              </div>
            ),
        },
        {
          id: "actions",
          title: "Aktionen",
          content: (
            <div className={styles.inspectorActions}>
              <button
                type="button"
                className="btn btn-sm btn-primary"
                disabled={!onToggleResolved}
                onClick={onToggleResolved}
              >
                {resolutionStatus === "resolved" ? "Als offen markieren" : "Als erledigt markieren"}
              </button>
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                disabled={!evidenceText}
                onClick={() => void handleCopyEvidence()}
              >
                {copyStatus === "copied"
                  ? "Kopiert"
                  : copyStatus === "error"
                    ? "Kopieren fehlgeschlagen"
                    : "Evidence kopieren"}
              </button>
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                disabled
                title="Folgt in einer späteren Phase"
              >
                Ausnahmen verwalten
              </button>
            </div>
          ),
        },
      ]}
    />
  );
}
