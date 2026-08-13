import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { useVisudev } from "../../../lib/visudev/store";
import { getVisuDevClient, isLocalVisuDevMode } from "../../../lib/visudev-api";
import { blueprintAPI } from "../../../utils/api";
import { BlueprintFooterStatusBar } from "../components/BlueprintFooterStatusBar";
import { BlueprintShellHeader } from "../components/BlueprintShellHeader";
import { BlueprintViewShell } from "../components/BlueprintViewShell";
import {
  computeBlueprintGraphStats,
  formatRelativeFreshness,
} from "../components/blueprint-graph-stats";
import type { BlueprintShellViewId } from "../blueprint-view-config";
import { normalizeBlueprintData } from "../../../lib/visudev/normalize-blueprint";
import { getProjectSourceMode } from "../../../lib/visudev/project-source";
import type { BlueprintData } from "../types";
import styles from "../styles/BlueprintPage.module.css";

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

interface BlueprintPageProps {
  projectId: string;
  activeView: BlueprintShellViewId;
}

export function BlueprintPage({ projectId, activeView }: BlueprintPageProps) {
  const { activeProject, scanStatuses, startScan } = useVisudev();
  const [isRescan, setIsRescan] = useState(false);
  const [blueprint, setBlueprint] = useState<BlueprintData | null>(null);
  const [blueprintLoadError, setBlueprintLoadError] = useState<string | null>(null);

  const loadBlueprint = useCallback(async () => {
    if (!projectId) return;
    setBlueprintLoadError(null);
    if (isLocalVisuDevMode()) {
      const latest = await getVisuDevClient().getBlueprintLatest(projectId);
      if (latest?.blueprint) {
        setBlueprint(normalizeBlueprintData(latest.blueprint as Record<string, unknown>));
      } else {
        setBlueprint(null);
      }
      return;
    }
    const res = await blueprintAPI.get(projectId);
    if (res.success && res.data) {
      setBlueprint(normalizeBlueprintData(res.data as Record<string, unknown>));
    } else {
      setBlueprint(null);
      if (!res.success)
        setBlueprintLoadError(res.error ?? "Blueprint konnte nicht geladen werden.");
    }
  }, [projectId]);

  const handleRescan = useCallback(async () => {
    setIsRescan(true);
    try {
      await startScan("blueprint");
    } finally {
      setIsRescan(false);
    }
  }, [startScan]);

  useEffect(() => {
    if (
      activeProject &&
      (!isLocalVisuDevMode() || activeProject.local_path) &&
      scanStatuses.blueprint.status === "idle"
    ) {
      handleRescan();
    }
  }, [activeProject, projectId, scanStatuses.blueprint.status, handleRescan]);

  useEffect(() => {
    if (projectId && scanStatuses.blueprint.status !== "running" && !isRescan) {
      loadBlueprint();
    }
  }, [projectId, scanStatuses.blueprint.status, isRescan, loadBlueprint]);

  const isScanning = scanStatuses.blueprint.status === "running" || isRescan;
  const hasError = scanStatuses.blueprint.status === "failed";
  const scanError = scanStatuses.blueprint.error;
  const isLocalProject = activeProject ? getProjectSourceMode(activeProject) === "local" : false;
  const scanCompleted = scanStatuses.blueprint.status === "completed";
  const hasContent =
    (blueprint?.graph != null &&
      (blueprint.graph.nodes.length > 0 || blueprint.graph.edges.length > 0)) ||
    (Array.isArray(blueprint?.routes) && blueprint.routes.length > 0) ||
    (Array.isArray(blueprint?.findings) && blueprint.findings.length > 0) ||
    (Array.isArray(blueprint?.facts) && blueprint.facts.length > 0);
  const hasData = blueprint != null && (scanCompleted || hasContent);
  const effectiveScanStatus =
    scanCompleted || (blueprint != null && hasContent && !isScanning && !hasError)
      ? "completed"
      : scanStatuses.blueprint.status;

  const lastScannedLabel = useMemo(() => {
    const analyzedAt = blueprint?.analyzedAt ?? blueprint?.graph?.analyzedAt;
    if (typeof analyzedAt !== "string") return null;
    return formatRelativeFreshness(analyzedAt);
  }, [blueprint?.analyzedAt, blueprint?.graph?.analyzedAt]);

  const handleExportJson = useCallback(() => {
    const data = blueprint ?? {};
    downloadFile(JSON.stringify(data, null, 2), `blueprint-${projectId}.json`, "application/json");
  }, [blueprint, projectId]);

  const notificationCount = useMemo(() => {
    if (!blueprint?.findings?.length) return 0;
    return blueprint.findings.filter(
      (finding) => finding.severity === "high" || finding.severity === "critical",
    ).length;
  }, [blueprint?.findings]);

  const branchLabel = activeProject?.github_branch ?? "main";

  const graphStats = useMemo(
    () => computeBlueprintGraphStats(blueprint?.graph, blueprint?.filesAnalyzed ?? 0),
    [blueprint?.graph, blueprint?.filesAnalyzed],
  );

  const freshnessLabel = useMemo(() => {
    const updatedAt = blueprint?.updatedAt ?? blueprint?.graph?.analyzedAt;
    if (typeof updatedAt === "string") return formatRelativeFreshness(updatedAt);
    if (scanCompleted) return "nach letztem Scan";
    return "—";
  }, [blueprint?.updatedAt, blueprint?.graph?.analyzedAt, scanCompleted]);

  return (
    <div className={styles.root}>
      <BlueprintShellHeader
        projectName={activeProject?.name}
        branchLabel={branchLabel}
        scanStatus={effectiveScanStatus}
        lastScannedLabel={lastScannedLabel}
        isRescanning={isRescan}
        notificationCount={notificationCount}
        onRescan={handleRescan}
        onExportJson={handleExportJson}
        rescanDisabled={isScanning}
      />

      {isScanning ? (
        <div className={styles.scanProgress}>
          <div className={`${styles.statusBar} ${styles.statusInfo}`} role="status">
            <Loader2 className={`${styles.inlineIcon} ${styles.spinner}`} aria-hidden="true" />
            <div>
              <p className={styles.statusTitle}>Blueprint wird analysiert...</p>
              <p className={styles.statusMeta}>
                {isLocalProject
                  ? `Lokal: ${activeProject?.local_path ?? "—"}`
                  : `Repo: ${activeProject?.github_repo ?? "—"} @ ${branchLabel}`}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <div className={styles.content}>
        {isScanning ? (
          <div className={styles.centerState}>
            <div className={styles.emptyCard}>
              <Loader2 className={`${styles.emptyIcon} ${styles.spinner}`} aria-hidden="true" />
              <p className={styles.emptyTitle}>Blueprint wird generiert...</p>
            </div>
          </div>
        ) : hasError ? (
          <div className={styles.centerState}>
            <div className={styles.emptyCard}>
              <AlertCircle
                className={`${styles.emptyIcon} ${styles.errorIcon}`}
                aria-hidden="true"
              />
              <p className={styles.emptyTitle}>Fehler bei der Blueprint-Generierung</p>
              {scanError ? <p className={styles.emptyHint}>{scanError}</p> : null}
            </div>
          </div>
        ) : !hasData ? (
          <div className={styles.centerState}>
            <div className={styles.emptyCard}>
              <p className={styles.emptyHint}>
                {blueprintLoadError ??
                  (isLocalProject
                    ? "Keine Blueprint-Daten. Starte „Neu analysieren“ (npm run dev muss laufen)."
                    : "Keine Blueprint-Daten. Starte „Neu analysieren“ oder verbinde ein GitHub-Repo.")}
              </p>
            </div>
          </div>
        ) : blueprint ? (
          <BlueprintViewShell
            blueprint={blueprint}
            projectId={projectId}
            activeView={activeView}
            projectName={activeProject?.name}
            branchLabel={activeProject?.github_branch ?? "main"}
          />
        ) : null}
      </div>

      {hasData ? (
        <BlueprintFooterStatusBar
          stats={graphStats}
          freshnessLabel={freshnessLabel}
          onRefresh={handleRescan}
          refreshDisabled={isScanning}
          criticalCount={notificationCount}
        />
      ) : null}
    </div>
  );
}
