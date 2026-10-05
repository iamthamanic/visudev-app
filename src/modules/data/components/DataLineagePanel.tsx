/**
 * Data detail tab: Forward Lineage / Reverse Impact from canonical DataLineage (PR-22).
 * Renders model hops only — no UI inference of joins.
 * Location: src/modules/data/components/DataLineagePanel.tsx
 */

import { useEffect, useState } from "react";
import clsx from "clsx";
import type { DataLineageGraph, DataLineagePath } from "../../../lib/visudev-api/data-lineage";
import {
  LINEAGE_DEFAULT_LIMIT,
  queryLineagePaths,
  slicePathHops,
  type LineageDirection,
  type QueryLineagePathsResult,
} from "../lib/data-lineage-navigation";
import type { ERDTableNode } from "../types";
import {
  lineageDirectionLabel,
  lineageKnowledgeStatusLabel,
  lineageLayerLabel,
  lineagePathStatusLabel,
} from "./data-lineage-display";
import styles from "../styles/DataPage.module.css";

export interface DataLineagePanelProps {
  table: ERDTableNode;
  lineage: DataLineageGraph | null;
  loading: boolean;
  error: string | null;
  hasSoftwareGraph: boolean;
}

function tableLabels(table: ERDTableNode): string[] {
  const out = [table.id, table.label, table.name].filter(
    (value): value is string => typeof value === "string" && value.length > 0,
  );
  return Array.from(new Set(out));
}

function PathCard({
  path,
  direction,
  anchorId,
  labels,
}: {
  path: DataLineagePath;
  direction: LineageDirection;
  anchorId: string;
  labels: string[];
}) {
  const hops = slicePathHops(path, { entityId: anchorId, labels }, direction);
  return (
    <article className={styles.lineagePath} data-testid="lineage-path">
      <header className={styles.lineagePathHeader}>
        <span
          className={clsx(
            styles.lineageBadge,
            path.status === "complete" && styles.lineageBadgeOk,
            path.status === "partial" && styles.lineageBadgeWarn,
            path.status === "unresolved" && styles.lineageBadgeMute,
          )}
        >
          {lineagePathStatusLabel(path.status)}
        </span>
        <code className={styles.lineagePathId}>{path.id}</code>
      </header>
      {(path.status === "partial" || path.status === "unresolved") && path.truncationReason ? (
        <p className={styles.lineageTruncation}>
          Pfad endet ehrlich: <code>{path.truncationReason}</code>
        </p>
      ) : null}
      {hops.length === 0 ? (
        <p className={styles.emptyHint}>Keine Hops in dieser Richtung für die Auswahl.</p>
      ) : (
        <ol className={styles.lineageHopList}>
          {hops.map((hop, index) => (
            <li key={`${path.id}:${index}`} className={styles.lineageHop}>
              <div className={styles.lineageHopTitle}>
                <span>
                  {lineageLayerLabel(hop.from.layer)} → {lineageLayerLabel(hop.to.layer)}
                </span>
                <span className={styles.lineageBadge}>
                  {lineageKnowledgeStatusLabel(hop.knowledgeStatus)}
                </span>
              </div>
              <p className={styles.lineageHopMeta}>
                {hop.from.label} → {hop.to.label}
              </p>
              <p className={styles.lineageHopMeta}>
                Join: <code>{hop.joinRuleId}</code>
              </p>
              {hop.evidence.length === 0 ? (
                <p className={styles.emptyHint}>Keine Evidence — Hop unvollständig belegt.</p>
              ) : (
                <ul className={styles.lineageEvidenceList}>
                  {hop.evidence.map((item) => (
                    <li key={`${path.id}:${item.evidenceId}:${item.kind}`}>
                      <span>{item.kind}</span>
                      {item.summary ? <span> — {item.summary}</span> : null}
                      {item.filePath ? (
                        <code className={styles.lineageEvidencePath}>
                          {item.filePath}
                          {typeof item.line === "number" ? `:${item.line}` : ""}
                        </code>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ol>
      )}
    </article>
  );
}

export function DataLineagePanel({
  table,
  lineage,
  loading,
  error,
  hasSoftwareGraph,
}: DataLineagePanelProps) {
  const [direction, setDirection] = useState<LineageDirection>("forward");
  const [searchQuery, setSearchQuery] = useState("");
  const [limit, setLimit] = useState(LINEAGE_DEFAULT_LIMIT);
  const [result, setResult] = useState<QueryLineagePathsResult>({
    paths: [],
    total: 0,
    truncated: false,
  });

  useEffect(() => {
    const labels = tableLabels(table);
    setResult(
      queryLineagePaths({
        graph: lineage,
        anchor: { entityId: table.id, labels },
        direction,
        searchQuery,
        limit,
      }),
    );
  }, [lineage, table, direction, searchQuery, limit]);

  if (loading) {
    return <p className={styles.emptyHint}>Lineage wird geladen…</p>;
  }
  if (error) {
    return <p className={styles.emptyHint}>{error}</p>;
  }
  if (!hasSoftwareGraph) {
    return (
      <p className={styles.emptyHint}>
        Kein SoftwareGraph vorhanden. Bitte zuerst Blueprint analysieren — Lineage braucht
        evidence-backed Graph-Daten.
      </p>
    );
  }
  if (!lineage) {
    return <p className={styles.emptyHint}>Kein Lineage-Modell verfügbar.</p>;
  }

  const labels = tableLabels(table);

  return (
    <div className={styles.lineageRoot} data-testid="data-lineage-panel">
      <div className={styles.lineageToolbar} role="tablist" aria-label="Lineage-Richtung">
        {(["forward", "reverse"] as const).map((item) => (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={direction === item}
            className={clsx(styles.panelTab, direction === item && styles.panelTabActive)}
            onClick={() => setDirection(item)}
          >
            {lineageDirectionLabel(item)}
          </button>
        ))}
      </div>
      <p className={styles.lineageStats}>
        Pfade: {lineage.stats.pathCount} · vollständig {lineage.stats.completeCount} · teilweise{" "}
        {lineage.stats.partialCount} · ungeklärt {lineage.stats.unresolvedCount}
      </p>
      <label className={styles.lineageSearch}>
        <span className={styles.lineageSearchLabel}>Filter</span>
        <input
          type="search"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Pfad, Entity oder Join filtern…"
          className={styles.lineageSearchInput}
        />
      </label>
      {result.total === 0 ? (
        <p className={styles.emptyHint}>
          Keine evidence-backed Pfade für diese Tabelle in Richtung{" "}
          {lineageDirectionLabel(direction)}.
        </p>
      ) : (
        <>
          <p className={styles.lineageStats}>
            {result.paths.length} von {result.total} Pfad(en)
            {result.truncated ? " (gekappt — Filter/Drill-down nutzen)" : ""}
          </p>
          <div className={styles.lineagePathList}>
            {result.paths.map((path) => (
              <PathCard
                key={path.id}
                path={path}
                direction={direction}
                anchorId={table.id}
                labels={labels}
              />
            ))}
          </div>
          {result.truncated ? (
            <button
              type="button"
              className={styles.lineageMore}
              onClick={() => setLimit((value) => value + LINEAGE_DEFAULT_LIMIT)}
            >
              Weitere Pfade laden
            </button>
          ) : null}
        </>
      )}
    </div>
  );
}
