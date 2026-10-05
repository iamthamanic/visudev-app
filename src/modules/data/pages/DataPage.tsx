/**
 * DataPage: Datenbank-Schema mit ERD; Klick auf Tabelle öffnet Detail-Panel (Columns, RLS, Sample).
 * Schließen per X oder ESC. Location: src/modules/data/pages/DataPage.tsx
 */

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Loader2, RefreshCw, X } from "lucide-react";
import clsx from "clsx";
import { useVisudev } from "../../../lib/visudev/store";
import { getVisuDevClient, isLocalVisuDevMode } from "../../../lib/visudev-api";
import { api } from "../../../utils/api";
import { DataLineagePanel } from "../components/DataLineagePanel";
import { useDataLineage } from "../hooks/useDataLineage";
import { useERD } from "../hooks/useERD";
import type { ERDTableNode } from "../types";
import styles from "../styles/DataPage.module.css";

interface DataPageProps {
  projectId: string;
}

function getTables(erd: Record<string, unknown> | null): ERDTableNode[] {
  if (!erd) return [];
  const nodes =
    (erd.nodes as ERDTableNode[] | undefined) ?? (erd.tables as ERDTableNode[] | undefined);
  return Array.isArray(nodes) ? nodes : [];
}

export function DataPage({ projectId }: DataPageProps) {
  const { activeProject, scanStatuses, startScan } = useVisudev();
  const { erd, loading: erdLoading, error: erdError, refresh: refreshERD } = useERD(projectId);
  const {
    lineage,
    loading: lineageLoading,
    error: lineageError,
    hasSoftwareGraph,
  } = useDataLineage(projectId, erd);
  const [isRescan, setIsRescan] = useState(false);
  const [selectedTable, setSelectedTable] = useState<ERDTableNode | null>(null);
  const [detailTab, setDetailTab] = useState<"columns" | "rls" | "sample" | "lineage">("columns");
  const localScanBlocked = isLocalVisuDevMode() && !activeProject?.local_path;

  const handleRescan = useCallback(async () => {
    setIsRescan(true);
    try {
      await startScan("data");
      if (!isLocalVisuDevMode()) {
        await api.data.syncERD(projectId);
      }
      await refreshERD();
    } finally {
      setIsRescan(false);
    }
  }, [projectId, startScan, refreshERD]);

  useEffect(() => {
    if (localScanBlocked) return;
    if (activeProject && scanStatuses.data.status === "idle") {
      handleRescan();
    }
  }, [activeProject, projectId, scanStatuses.data.status, handleRescan, localScanBlocked]);

  useEffect(() => {
    if (!isLocalVisuDevMode() || !activeProject?.id || activeProject.id !== projectId) return;
    let cancelled = false;
    (async () => {
      const latest = await getVisuDevClient().getDataLatest(projectId);
      if (cancelled || !latest) return;
      await refreshERD();
    })().catch(() => {
      // ignore hydration errors; user can rescan manually
    });
    return () => {
      cancelled = true;
    };
  }, [activeProject, projectId, refreshERD]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && selectedTable) {
        setSelectedTable(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedTable]);

  const isScanning = scanStatuses.data.status === "running" || isRescan;
  const hasError = scanStatuses.data.status === "failed";
  const tables = getTables(erd ?? null);
  const hasTables = tables.length > 0;

  const tableName = (node: ERDTableNode) => node.label ?? node.name ?? node.id;

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <div className={styles.headerRow}>
          <div>
            <h1 className={styles.title}>Data</h1>
            <p className={styles.subtitle}>Datenbank-Schema • {activeProject?.name}</p>
          </div>
          <button
            type="button"
            onClick={handleRescan}
            disabled={isScanning || localScanBlocked}
            className={styles.primaryButton}
            title={
              localScanBlocked
                ? "Data Scan benötigt ein lokales Projekt mit .env (DATABASE_URL)."
                : undefined
            }
          >
            {isScanning ? (
              <>
                <Loader2 className={clsx(styles.inlineIcon, styles.spinner)} aria-hidden="true" />
                Analysiere...
              </>
            ) : (
              <>
                <RefreshCw className={styles.inlineIcon} aria-hidden="true" />
                Neu analysieren
              </>
            )}
          </button>
        </div>

        {isScanning && (
          <div className={`${styles.statusBar} ${styles.statusInfo}`} role="status">
            <Loader2 className={clsx(styles.inlineIcon, styles.spinner)} aria-hidden="true" />
            <div>
              <p className={styles.statusTitle}>Schema wird analysiert...</p>
              <p className={styles.statusMeta}>
                Repo: {activeProject?.github_repo ?? "—"} @ {activeProject?.github_branch ?? "main"}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className={styles.content}>
        {isScanning ? (
          <div className={styles.centerState}>
            <div className={styles.emptyCard}>
              <Loader2 className={clsx(styles.emptyIcon, styles.spinner)} aria-hidden="true" />
              <p className={styles.emptyTitle}>Schema wird analysiert...</p>
            </div>
          </div>
        ) : hasError ? (
          <div className={styles.centerState}>
            <div className={styles.emptyCard}>
              <AlertCircle
                className={clsx(styles.emptyIcon, styles.errorIcon)}
                aria-hidden="true"
              />
              <p className={styles.emptyTitle}>Fehler bei der Schema-Analyse</p>
            </div>
          </div>
        ) : erdLoading ? (
          <div className={styles.centerState}>
            <div className={styles.emptyCard}>
              <Loader2 className={clsx(styles.emptyIcon, styles.spinner)} aria-hidden="true" />
              <p className={styles.emptyTitle}>Lade ERD...</p>
            </div>
          </div>
        ) : erdError ? (
          <div className={styles.centerState}>
            <div className={styles.emptyCard}>
              <AlertCircle
                className={clsx(styles.emptyIcon, styles.errorIcon)}
                aria-hidden="true"
              />
              <p className={styles.emptyTitle}>{erdError}</p>
            </div>
          </div>
        ) : !hasTables ? (
          <div className={styles.centerState}>
            <div className={styles.emptyCard}>
              <p className={styles.emptyHint}>
                {(erd as Record<string, unknown> | null)?.message &&
                typeof (erd as Record<string, unknown>).message === "string"
                  ? String((erd as Record<string, unknown>).message)
                  : "Noch keine Tabellen. Schema analysieren oder ERD-Daten anlegen."}
              </p>
            </div>
          </div>
        ) : (
          <div className={styles.erdLayout}>
            <div className={styles.tableGrid}>
              {tables.map((node) => (
                <button
                  key={node.id}
                  type="button"
                  className={clsx(
                    styles.tableBox,
                    selectedTable?.id === node.id && styles.tableBoxActive,
                  )}
                  onClick={() => {
                    setSelectedTable(node);
                    setDetailTab("columns");
                  }}
                  aria-pressed={selectedTable?.id === node.id}
                  aria-label={`Tabelle ${tableName(node)} öffnen`}
                >
                  <span className={styles.tableBoxTitle}>{tableName(node)}</span>
                  {node.columns && (
                    <span className={styles.tableBoxMeta}>{node.columns.length} Spalte(n)</span>
                  )}
                </button>
              ))}
            </div>

            {selectedTable && (
              <aside
                className={styles.detailPanel}
                role="dialog"
                aria-modal="true"
                aria-label={`Detail: ${tableName(selectedTable)}`}
              >
                <div className={styles.panelHeader}>
                  <h2 className={styles.panelTitle}>{tableName(selectedTable)}</h2>
                  <button
                    type="button"
                    className={styles.panelClose}
                    onClick={() => setSelectedTable(null)}
                    aria-label="Panel schließen"
                  >
                    <X className={styles.panelCloseIcon} aria-hidden="true" />
                  </button>
                </div>
                <div className={styles.panelTabs} role="tablist">
                  {(["columns", "rls", "sample", "lineage"] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      role="tab"
                      aria-selected={detailTab === tab}
                      className={clsx(styles.panelTab, detailTab === tab && styles.panelTabActive)}
                      onClick={() => setDetailTab(tab)}
                    >
                      {tab === "columns" && "Columns"}
                      {tab === "rls" && "RLS"}
                      {tab === "sample" && "Sample"}
                      {tab === "lineage" && "Lineage"}
                    </button>
                  ))}
                </div>
                <div className={styles.panelContent} role="tabpanel">
                  {detailTab === "columns" && (
                    <div className={styles.tabContent}>
                      {selectedTable.columns && selectedTable.columns.length > 0 ? (
                        <ul className={styles.columnList}>
                          {selectedTable.columns.map((col, i) => (
                            <li key={i} className={styles.columnRow}>
                              <code className={styles.columnName}>{col.name}</code>
                              {col.type && <span className={styles.columnType}>{col.type}</span>}
                              {col.nullable && <span className={styles.columnMeta}>nullable</span>}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className={styles.emptyHint}>Keine Spalteninformationen.</p>
                      )}
                    </div>
                  )}
                  {detailTab === "rls" && (
                    <div className={styles.tabContent}>
                      {selectedTable.rls != null ? (
                        <pre className={styles.jsonBlock}>
                          {JSON.stringify(selectedTable.rls, null, 2)}
                        </pre>
                      ) : (
                        <p className={styles.emptyHint}>Keine RLS-Informationen.</p>
                      )}
                    </div>
                  )}
                  {detailTab === "sample" && (
                    <div className={styles.tabContent}>
                      {selectedTable.sample != null &&
                      Array.isArray(selectedTable.sample) &&
                      selectedTable.sample.length > 0 ? (
                        <pre className={styles.jsonBlock}>
                          {JSON.stringify(selectedTable.sample.slice(0, 5), null, 2)}
                        </pre>
                      ) : selectedTable.sample != null &&
                        typeof selectedTable.sample === "object" ? (
                        <pre className={styles.jsonBlock}>
                          {JSON.stringify(selectedTable.sample, null, 2)}
                        </pre>
                      ) : (
                        <p className={styles.emptyHint}>Keine Beispieldaten.</p>
                      )}
                    </div>
                  )}
                  {detailTab === "lineage" && (
                    <div className={styles.tabContent}>
                      <DataLineagePanel
                        table={selectedTable}
                        lineage={lineage}
                        loading={lineageLoading}
                        error={lineageError}
                        hasSoftwareGraph={hasSoftwareGraph}
                      />
                    </div>
                  )}
                </div>
              </aside>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
