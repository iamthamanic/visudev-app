/**
 * Problem-Inspektor — consequence-first (PU-13), technical evidence as drill-down.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import type { BlueprintFinding, CodeFact, RouteBlueprint, SecurityMatrixRow } from "../../types";
import { presentDiagnosticsFindingConsequence } from "../../../../../shared/product-understanding/index.js";
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
  const [techOpen, setTechOpen] = useState(false);
  const copyResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyResetRef.current) clearTimeout(copyResetRef.current);
    };
  }, []);

  useEffect(() => {
    setTechOpen(false);
  }, [finding?.id]);

  const evidenceFacts = useMemo(() => {
    if (!finding) return [];
    const factMap = new Map(facts.map((fact) => [fact.id, fact]));
    return finding.evidenceFactIds
      .map((id) => factMap.get(id))
      .filter((fact): fact is CodeFact => fact != null);
  }, [facts, finding]);

  const consequence = useMemo(
    () => (finding ? presentDiagnosticsFindingConsequence(finding) : null),
    [finding],
  );

  if (!finding || !consequence) {
    return (
      <InspectorPanel
        title="Keine Auswahl"
        emptyMessage="Wähle ein Finding, um Konsequenz und Evidence zu sehen."
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
      title={consequence.consequenceTitle}
      subtitle={consequence.confidenceLabel}
      badges={
        <StatusBadge
          variant={severityBadgeVariant(finding.severity)}
          label={SEVERITY_LABELS[finding.severity]}
        />
      }
      sections={[
        {
          id: "consequence",
          title: "Konsequenz",
          content: (
            <div
              data-testid="diagnostics-consequence"
              data-confidence={consequence.consequenceConfidence}
            >
              <p className={styles.consequenceBody}>{consequence.consequenceTitle}</p>
            </div>
          ),
        },
        {
          id: "why",
          title: "Warum relevant",
          content: <p className={styles.consequenceBody}>{consequence.whyItMatters}</p>,
        },
        {
          id: "observation",
          title: "Was VisuDev beobachtet",
          content: <p className={styles.consequenceBody}>{consequence.observation}</p>,
        },
        {
          id: "status",
          title: "Confidence / Status",
          content: (
            <dl className={styles.detailList}>
              <div className={styles.detailRow}>
                <dt>Confidence</dt>
                <dd>
                  <MetricHint
                    glossaryId="confidence"
                    source={formatConfidence(finding.confidence) == null ? "unbekannt" : "graph"}
                  >
                    {formatConfidence(finding.confidence) ?? "unbekannt"}
                  </MetricHint>
                  <span> · {consequence.confidenceLabel}</span>
                </dd>
              </div>
              <div className={styles.detailRow}>
                <dt>Bearbeitung</dt>
                <dd>{resolutionStatus === "resolved" ? "Erledigt" : "Offen"}</dd>
              </div>
            </dl>
          ),
        },
        {
          id: "technik",
          title: "Technik (Evidence)",
          content: (
            <div className={styles.techDrilldown}>
              <button
                type="button"
                className={styles.techToggle}
                data-testid="diagnostics-technik-toggle"
                aria-expanded={techOpen}
                onClick={() => setTechOpen((open) => !open)}
              >
                {techOpen ? "Technik ausblenden" : "Regel / Route / Code Evidence zeigen"}
              </button>
              {techOpen ? (
                <div data-testid="diagnostics-technik-panel">
                  <p className={styles.consequenceMeta}>{consequence.mechanismSummary}</p>
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
                  </ul>
                  <dl className={styles.detailList}>
                    <div className={styles.detailRow}>
                      <dt>Erwartet</dt>
                      <dd>{finding.expectedState}</dd>
                    </div>
                    <div className={styles.detailRow}>
                      <dt>Gefunden</dt>
                      <dd>{finding.actualState}</dd>
                    </div>
                    {consequence.remediation ? (
                      <div className={styles.detailRow}>
                        <dt>Mögliche Lösung</dt>
                        <dd>{consequence.remediation}</dd>
                      </div>
                    ) : null}
                  </dl>
                  {evidenceFacts.length === 0 ? (
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
                              isSqlEvidence(fact)
                                ? styles.evidenceSqlBlock
                                : styles.evidenceCodeBlock
                            }
                          >
                            {fact.snippet}
                          </pre>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
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
            </div>
          ),
        },
      ]}
    />
  );
}
