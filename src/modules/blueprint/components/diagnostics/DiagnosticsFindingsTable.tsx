/**
 * Paginated findings table for Diagnostics Security tab; drives Problem-Inspektor selection.
 * Wave 5: severity/area/search filter chrome around the table.
 * RVP-10: root-cause cluster overview with drill-down into original findings.
 */

import { useEffect, useMemo, useState } from "react";
import type { BlueprintFinding, CodeFact, RouteBlueprint } from "../../types";
import { StatusBadge } from "../ui/StatusBadge.js";
import { ViewSectionTitle } from "../ui/ViewSectionTitle.js";
import { DiagnosticsFindingsFilterBar } from "./DiagnosticsFindingsFilterBar.js";
import { DiagnosticsRootCauseClusters } from "./DiagnosticsRootCauseClusters.js";
import {
  clusterFindingsByRootCause,
  findingsForCluster,
} from "./diagnostics-root-cause-clusters.js";
import { findingAreaLabel } from "./diagnostics-finding-area.js";
import { SEVERITY_LABELS, severityBadgeVariant } from "./diagnostics-severity.js";
import { findingLocationLabel } from "./diagnostics-finding-location.js";
import type { FindingResolutionStatus } from "./finding-resolution.js";
import styles from "../../styles/DiagnosticsView.module.css";

const PAGE_SIZE = 5;

interface DiagnosticsFindingsTableProps {
  findings: BlueprintFinding[];
  facts: CodeFact[];
  routes: RouteBlueprint[];
  selectedFindingId: string | null;
  onSelectFinding: (id: string | null) => void;
  resolutionByFindingId?: Record<string, FindingResolutionStatus>;
}

export function DiagnosticsFindingsTable({
  findings,
  facts,
  routes,
  selectedFindingId,
  onSelectFinding,
  resolutionByFindingId = {},
}: DiagnosticsFindingsTableProps): JSX.Element {
  const [page, setPage] = useState(0);
  const [severity, setSeverity] = useState("all");
  const [area, setArea] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(null);
  const routeMap = useMemo(() => new Map(routes.map((route) => [route.id, route])), [routes]);

  const clusters = useMemo(
    () => clusterFindingsByRootCause({ findings, routes }),
    [findings, routes],
  );

  const selectedCluster = useMemo(
    () => clusters.find((cluster) => cluster.id === selectedClusterId) ?? null,
    [clusters, selectedClusterId],
  );

  const scopedFindings = useMemo(
    () => findingsForCluster(findings, selectedCluster),
    [findings, selectedCluster],
  );

  const areas = useMemo(() => {
    const unique = new Set(scopedFindings.map((finding) => findingAreaLabel(finding)));
    return Array.from(unique).sort((left, right) => left.localeCompare(right, "de"));
  }, [scopedFindings]);

  const filteredFindings = useMemo(() => {
    const query = search.trim().toLowerCase();
    return scopedFindings.filter((finding) => {
      if (severity !== "all" && finding.severity !== severity) return false;
      if (area !== "all" && findingAreaLabel(finding) !== area) return false;
      if (!query) return true;
      const haystack = [
        finding.ruleId,
        finding.message,
        finding.category,
        findingAreaLabel(finding),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [scopedFindings, severity, area, search]);

  const pageCount = Math.max(1, Math.ceil(filteredFindings.length / PAGE_SIZE));

  useEffect(() => {
    if (page > pageCount - 1) {
      setPage(Math.max(0, pageCount - 1));
    }
  }, [page, pageCount]);

  useEffect(() => {
    setPage(0);
  }, [findings, severity, area, search, selectedClusterId]);

  useEffect(() => {
    if (selectedClusterId && !clusters.some((cluster) => cluster.id === selectedClusterId)) {
      setSelectedClusterId(null);
    }
  }, [clusters, selectedClusterId]);

  const pageFindings = useMemo(() => {
    const start = page * PAGE_SIZE;
    return filteredFindings.slice(start, start + PAGE_SIZE);
  }, [filteredFindings, page]);

  const findingsTitle = selectedCluster
    ? `Findings in Ursache (${filteredFindings.length})`
    : `Findings (${findings.length})`;

  return (
    <div className={styles.findingsWithClusters}>
      <DiagnosticsRootCauseClusters
        clusters={clusters}
        selectedClusterId={selectedClusterId}
        onSelectCluster={setSelectedClusterId}
      />
      <section className={styles.findingsSectionInner} aria-label="Findings">
        <div className={styles.findingsHeaderRow}>
          <ViewSectionTitle>{findingsTitle}</ViewSectionTitle>
          <DiagnosticsFindingsFilterBar
            severity={severity}
            area={area}
            search={search}
            areas={areas}
            onSeverityChange={setSeverity}
            onAreaChange={setArea}
            onSearchChange={setSearch}
          />
        </div>
        {filteredFindings.length === 0 ? (
          <p className={styles.emptyControls}>Keine Findings für diese Auswahl.</p>
        ) : (
          <>
            <div className={styles.findingsTableWrap}>
              <table className={styles.findingsTable} data-testid="findings-table">
                <thead>
                  <tr>
                    <th>Schwere</th>
                    <th>Regel</th>
                    <th>Ort</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {pageFindings.map((finding) => {
                    const isActive = finding.id === selectedFindingId;
                    const route = routeMap.get(finding.scopeId) ?? null;
                    const location = findingLocationLabel(finding, facts, route);
                    return (
                      <tr
                        key={finding.id}
                        className={isActive ? styles.findingsRowActive : undefined}
                      >
                        <td>
                          <button
                            type="button"
                            className={styles.findingsRowButton}
                            aria-pressed={isActive}
                            onClick={() =>
                              onSelectFinding(finding.id === selectedFindingId ? null : finding.id)
                            }
                          >
                            <StatusBadge
                              variant={severityBadgeVariant(finding.severity)}
                              label={SEVERITY_LABELS[finding.severity]}
                            />
                          </button>
                        </td>
                        <td>
                          <button
                            type="button"
                            className={styles.findingsRowButton}
                            aria-pressed={isActive}
                            onClick={() =>
                              onSelectFinding(finding.id === selectedFindingId ? null : finding.id)
                            }
                          >
                            <code className={styles.findingsRule}>{finding.ruleId}</code>
                            <span className={styles.findingMessage}>{finding.message}</span>
                          </button>
                        </td>
                        <td>
                          <button
                            type="button"
                            className={styles.findingsRowButton}
                            aria-pressed={isActive}
                            onClick={() =>
                              onSelectFinding(finding.id === selectedFindingId ? null : finding.id)
                            }
                          >
                            <span className={styles.findingsLocation}>{location}</span>
                          </button>
                        </td>
                        <td>
                          <span
                            className={styles.findingsStatus}
                            data-testid={`finding-status-${finding.id}`}
                          >
                            {resolutionByFindingId[finding.id] === "resolved"
                              ? "Erledigt"
                              : "Offen"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div
              className={styles.findingsPagination}
              aria-label="Findings-Seiten"
              data-testid="findings-pagination"
              data-total={filteredFindings.length}
            >
              <span className={styles.findingsPageLabel}>
                {filteredFindings.length === 0
                  ? "0 von 0 Findings"
                  : `${page * PAGE_SIZE + 1}-${Math.min(filteredFindings.length, (page + 1) * PAGE_SIZE)} von ${filteredFindings.length} Findings`}
              </span>
              <div className={styles.findingsPageActions}>
                <button
                  type="button"
                  className="btn btn-sm btn-ghost"
                  disabled={page === 0}
                  onClick={() => setPage((current) => Math.max(0, current - 1))}
                >
                  Zurück
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-ghost"
                  disabled={page >= pageCount - 1}
                  onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))}
                >
                  Weiter
                </button>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
