/**
 * DataPage: business information flow by default (PU-11); ERD/schema as Technik drill-down.
 * Location: src/modules/data/pages/DataPage.tsx
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Loader2, RefreshCw, X } from "lucide-react";
import clsx from "clsx";
import { useVisudev } from "../../../lib/visudev/store";
import { getVisuDevClient, isLocalVisuDevMode } from "../../../lib/visudev-api";
import { api } from "../../../utils/api";
import { DataInformationFlowView } from "../components/DataInformationFlowView";
import { DataLineagePanel } from "../components/DataLineagePanel";
import { useDataLineage } from "../hooks/useDataLineage";
import { useERD } from "../hooks/useERD";
import { resolveDataInformationFlowProjection } from "../services/resolve-data-product-model";
import { useProductConceptSelectionUrl } from "../../../hooks/useProductConceptSelectionUrl.js";
import { ProductConceptMissingInView } from "../../../components/ui/ProductConceptMissingInView.js";
import { resolveCrossViewFocus } from "../../../../shared/product-understanding/cross-view-selection.js";
import { isProductConceptSelectionId } from "../../../../shared/product-understanding/selection.js";
import type { ERDTableNode } from "../types";
import styles from "../styles/DataPage.module.css";

interface DataPageProps {
  projectId: string;
}

type DataLayer = "information" | "schema";

function getTables(erd: Record<string, unknown> | null): ERDTableNode[] {
  if (!erd) return [];
  const nodes =
    (erd.nodes as ERDTableNode[] | undefined) ?? (erd.tables as ERDTableNode[] | undefined);
  return Array.isArray(nodes) ? nodes : [];
}

function matchTable(tables: ERDTableNode[], key: string | null): ERDTableNode | null {
  if (!key) return tables[0] ?? null;
  const needle = key.trim().toLowerCase();
  return (
    tables.find((table) => {
      const labels = [table.id, table.label, table.name]
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.toLowerCase());
      return labels.some(
        (label) => label === needle || label.includes(needle) || needle.includes(label),
      );
    }) ??
    tables[0] ??
    null
  );
}

export function DataPage({ projectId }: DataPageProps) {
  const { activeProject, scanStatuses, startScan } = useVisudev();
  const { erd, loading: erdLoading, error: erdError, refresh: refreshERD } = useERD(projectId);
  const {
    lineage,
    loading: lineageLoading,
    error: lineageError,
    hasSoftwareGraph,
    software,
  } = useDataLineage(projectId, erd);
  const [isRescan, setIsRescan] = useState(false);
  const [layer, setLayer] = useState<DataLayer>("information");
  const [selectedInfoId, setSelectedInfoId] = useState<string | null>(null);
  const [selectedTable, setSelectedTable] = useState<ERDTableNode | null>(null);
  const [detailTab, setDetailTab] = useState<"columns" | "rls" | "sample" | "lineage">("columns");
  const localScanBlocked = isLocalVisuDevMode() && !activeProject?.local_path;
  const { selection, setSelection } = useProductConceptSelectionUrl();

  const infoProjection = useMemo(
    () =>
      resolveDataInformationFlowProjection({
        projectId,
        software,
        lineage,
        analyzedAt: software?.analyzedAt,
      }),
    [lineage, projectId, software],
  );

  const dataConceptIds = useMemo(
    () => infoProjection?.cards.map((card) => card.conceptId) ?? [],
    [infoProjection],
  );

  const dataFocus = useMemo(
    () => (selection ? resolveCrossViewFocus(selection, "data", dataConceptIds) : null),
    [dataConceptIds, selection],
  );

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

  useEffect(() => {
    const cards = infoProjection?.cards ?? [];
    if (cards.length === 0) {
      if (!selection) setSelectedInfoId(null);
      return;
    }
    if (dataFocus?.presentInView && dataFocus.viewLocalId) {
      const card = cards.find((item) => item.conceptId === dataFocus.viewLocalId);
      if (card) {
        setSelectedInfoId(card.id);
        return;
      }
    }
    if (selection && dataFocus && !dataFocus.presentInView) {
      return;
    }
    if (!selectedInfoId || !cards.some((card) => card.id === selectedInfoId)) {
      setSelectedInfoId(cards[0]!.id);
    }
  }, [infoProjection, selectedInfoId, selection, dataFocus]);

  const isScanning = scanStatuses.data.status === "running" || isRescan;
  const hasError = scanStatuses.data.status === "failed";
  const tables = getTables(erd ?? null);
  const hasTables = tables.length > 0;
  const tableName = (node: ERDTableNode) => node.label ?? node.name ?? node.id;

  const openSchemaForKey = (tableKey: string | null) => {
    setLayer("schema");
    const matched = matchTable(tables, tableKey);
    setSelectedTable(matched);
    setDetailTab(matched ? "lineage" : "columns");
  };

  const retryBlocked = isScanning || localScanBlocked;
  const showLineageError = Boolean(lineageError) && layer === "information";
  const showErdError = Boolean(erdError) && layer === "schema";

  return (
    <div className={styles.root} data-testid="data-page">
      {dataFocus && !dataFocus.presentInView && selection ? (
        <ProductConceptMissingInView selection={selection} messageDe={dataFocus.messageDe} />
      ) : null}
      <div className={styles.header}>
        <div className={styles.headerRow}>
          <div>
            <h1 className={styles.title}>Data</h1>
            <p className={styles.subtitle}>
              {layer === "information"
                ? `Fachliche Informationen • ${activeProject?.name ?? "—"}`
                : `Datenbank-Schema • ${activeProject?.name ?? "—"}`}
            </p>
          </div>
          <div className={styles.headerActions}>
            <label className={styles.layerLabel}>
              <span className="sr-only">Data-Ebene</span>
              <select
                className={styles.layerSelect}
                value={layer}
                aria-label="Data-Ebene wählen"
                data-testid="data-layer-select"
                onChange={(event) => {
                  setLayer(event.target.value as DataLayer);
                  if (event.target.value === "information") setSelectedTable(null);
                }}
              >
                <option value="information">Informationen</option>
                <option value="schema">Schema (Technik)</option>
              </select>
            </label>
            <button
              type="button"
              onClick={handleRescan}
              disabled={retryBlocked}
              className={styles.primaryButton}
              data-testid="data-rescan"
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
        ) : hasError || showLineageError || showErdError ? (
          <div className={styles.centerState}>
            <div className={styles.emptyCard}>
              <AlertCircle
                className={clsx(styles.emptyIcon, styles.errorIcon)}
                aria-hidden="true"
              />
              <p className={styles.emptyTitle}>
                {showLineageError
                  ? lineageError
                  : showErdError
                    ? erdError
                    : "Fehler bei der Schema-Analyse"}
              </p>
              <button
                type="button"
                className={styles.primaryButton}
                disabled={retryBlocked}
                data-testid="data-error-retry"
                onClick={handleRescan}
              >
                Erneut versuchen
              </button>
            </div>
          </div>
        ) : layer === "information" ? (
          lineageLoading && !infoProjection ? (
            <div className={styles.centerState}>
              <div className={styles.emptyCard}>
                <Loader2 className={clsx(styles.emptyIcon, styles.spinner)} aria-hidden="true" />
                <p className={styles.emptyTitle}>Lade Informationsfluss...</p>
              </div>
            </div>
          ) : (
            <DataInformationFlowView
              cards={infoProjection?.cards ?? []}
              selectedId={selectedInfoId}
              partialReason={infoProjection?.partialReason ?? null}
              onSelect={(cardId) => {
                setSelectedInfoId(cardId);
                const card = infoProjection?.cards.find((item) => item.id === cardId);
                if (card && isProductConceptSelectionId(card.conceptId)) {
                  setSelection(card.conceptId, null, "data");
                }
              }}
              onOpenSchema={openSchemaForKey}
            />
          )
        ) : erdLoading ? (
          <div className={styles.centerState}>
            <div className={styles.emptyCard}>
              <Loader2 className={clsx(styles.emptyIcon, styles.spinner)} aria-hidden="true" />
              <p className={styles.emptyTitle}>Lade ERD...</p>
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
          <div className={styles.erdLayout} data-testid="data-schema-erd">
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
