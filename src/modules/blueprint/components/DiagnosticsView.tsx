/**
 * Blueprint Diagnostics view — consequence-first findings (PU-13); matrix/route as context.
 */

import { useMemo, useState } from "react";
import { RouteBlueprintCanvas } from "./RouteBlueprintCanvas";
import { SecurityMatrix } from "./SecurityMatrix";
import { AccessControlMatrix } from "./AccessControlMatrix";
import { isAccessControlV2Enabled } from "../access-control-flag.js";
import { useDiagnosticsSelection } from "./useDiagnosticsSelection";
import { useDiagnosticsFindingResolution } from "./useDiagnosticsFindingResolution";
import { BlueprintViewLayout } from "./ui/BlueprintViewLayout.js";
import { ViewSectionTitle } from "./ui/ViewSectionTitle.js";
import { DiagnosticsFindingsTable } from "./diagnostics/DiagnosticsFindingsTable.js";
import { DiagnosticsProblemInspector } from "./diagnostics/DiagnosticsProblemInspector.js";
import { AccessControlInspector } from "./diagnostics/AccessControlInspector.js";
import {
  MATRIX_COLUMN_TO_CONTROL,
  type MatrixControlColumn,
} from "./diagnostics/access-control-matrix-columns.js";
import { DiagnosticsSubTabs, type DiagnosticsTabId } from "./diagnostics/DiagnosticsSubTabs.js";
import { DiagnosticsProjectionTab } from "./diagnostics/DiagnosticsProjectionTab.js";
import type { AccessControlControl } from "../../../lib/visudev/access-control-types";
import type { BlueprintData } from "../types";
import { BlueprintViewStateGate } from "./ui/BlueprintViewStateGate.js";
import type { BlueprintViewScanProps } from "../blueprint-view-state.js";
import { TruncationBanner } from "../../../components/ui/TruncationBanner.js";
import styles from "../styles/DiagnosticsView.module.css";

interface DiagnosticsViewProps extends BlueprintViewScanProps {
  blueprint: BlueprintData;
}

export function DiagnosticsView({
  blueprint,
  scanStatus,
  scanError,
  onRetry,
}: DiagnosticsViewProps) {
  const [activeTab, setActiveTab] = useState<DiagnosticsTabId>("security");
  const [selectedAcColumn, setSelectedAcColumn] = useState<MatrixControlColumn | null>(null);
  const [showTechnikContext, setShowTechnikContext] = useState(false);
  const {
    routes,
    matrix,
    facts,
    selectedRouteId,
    selectedRoute,
    routeFindings,
    selectedFindingId,
    setSelectedFindingId,
    selectRoute,
  } = useDiagnosticsSelection(blueprint);

  const selectedFinding = useMemo(
    () => routeFindings.find((finding) => finding.id === selectedFindingId) ?? null,
    [routeFindings, selectedFindingId],
  );

  const { resolutionByFindingId, selectedResolutionStatus, toggleSelectedFindingResolved } =
    useDiagnosticsFindingResolution(blueprint, selectedFinding);

  const selectedMatrixRow = useMemo(
    () => matrix.find((row) => row.routeId === selectedRouteId) ?? null,
    [matrix, selectedRouteId],
  );

  const inspectorRoute = useMemo(() => {
    if (!selectedFinding) return selectedRoute;
    return routes.find((route) => route.id === selectedFinding.scopeId) ?? selectedRoute;
  }, [routes, selectedFinding, selectedRoute]);

  const inspectorMatrixRow = useMemo(() => {
    if (!selectedFinding) return selectedMatrixRow;
    return matrix.find((row) => row.routeId === selectedFinding.scopeId) ?? selectedMatrixRow;
  }, [matrix, selectedFinding, selectedMatrixRow]);

  const accessControlRows = blueprint.accessControlMatrix ?? [];
  const accessControlFindings = blueprint.accessControlFindings ?? [];
  const useAccessControlV2 = isAccessControlV2Enabled() && accessControlRows.length > 0;

  const selectedAcControl: AccessControlControl | null = selectedAcColumn
    ? MATRIX_COLUMN_TO_CONTROL[selectedAcColumn]
    : null;

  const filesAnalyzed = blueprint.filesAnalyzed ?? 0;
  const totalFiles = blueprint.totalFiles ?? null;
  const isPartialScan =
    blueprint.graph?.condensed === true ||
    (totalFiles != null && filesAnalyzed > 0 && filesAnalyzed < totalFiles) ||
    (blueprint.truncation as { truncated?: boolean } | undefined)?.truncated === true;

  const handleSelectRoute = (routeId: string) => {
    setSelectedAcColumn(null);
    setSelectedFindingId(null);
    selectRoute(routeId);
  };

  const handleSelectAcCell = (routeId: string, column: MatrixControlColumn) => {
    setSelectedFindingId(null);
    setSelectedAcColumn(column);
    selectRoute(routeId);
  };

  const handleSelectFinding = (findingId: string | null) => {
    setSelectedAcColumn(null);
    setSelectedFindingId(findingId);
  };

  const showAccessControlInspector = useAccessControlV2 && selectedFinding == null;
  const hasViewData =
    routeFindings.length > 0 ||
    matrix.length > 0 ||
    routes.length > 0 ||
    accessControlRows.length > 0;

  if (!hasViewData) {
    return (
      <BlueprintViewStateGate
        viewId="diagnostics"
        hasViewData={false}
        scanStatus={scanStatus}
        scanError={scanError}
        onRetry={onRetry}
      >
        {null}
      </BlueprintViewStateGate>
    );
  }

  return (
    <div className={styles.root}>
      <DiagnosticsSubTabs activeTab={activeTab} onSelectTab={setActiveTab} />

      {activeTab === "security" ? (
        <BlueprintViewLayout
          canvas={
            <div className={styles.securityCanvas}>
              {isPartialScan ? (
                <div data-testid="diagnostics-partial-banner">
                  <TruncationBanner analyzed={filesAnalyzed} total={totalFiles} />
                </div>
              ) : null}
              <section aria-label="Findings" className={styles.findingsSection}>
                <DiagnosticsFindingsTable
                  findings={routeFindings}
                  facts={facts}
                  routes={routes}
                  selectedFindingId={selectedFindingId}
                  onSelectFinding={handleSelectFinding}
                  resolutionByFindingId={resolutionByFindingId}
                />
              </section>
              <div className={styles.technikContext}>
                <button
                  type="button"
                  className={styles.techToggle}
                  data-testid="diagnostics-context-technik"
                  aria-expanded={showTechnikContext}
                  onClick={() => setShowTechnikContext((open) => !open)}
                >
                  {showTechnikContext
                    ? "Matrix / Route ausblenden"
                    : "Matrix / Route (Technik) anzeigen"}
                </button>
                {showTechnikContext ? (
                  <div data-testid="diagnostics-technik-context">
                    <section aria-labelledby="matrix-title">
                      <ViewSectionTitle>Sicherheits-Matrix</ViewSectionTitle>
                      {useAccessControlV2 ? (
                        <AccessControlMatrix
                          rows={accessControlRows}
                          selectedRouteId={selectedRouteId}
                          selectedControl={selectedAcColumn}
                          onSelectRoute={handleSelectRoute}
                          onSelectCell={handleSelectAcCell}
                        />
                      ) : (
                        <SecurityMatrix
                          rows={matrix}
                          selectedRouteId={selectedRouteId}
                          onSelectRoute={selectRoute}
                        />
                      )}
                    </section>
                    <RouteBlueprintCanvas route={selectedRoute} />
                  </div>
                ) : null}
              </div>
            </div>
          }
          inspector={
            showAccessControlInspector ? (
              <AccessControlInspector
                findings={accessControlFindings}
                routeId={selectedRouteId}
                selectedControl={selectedAcControl}
                routeLabel={selectedRoute ? `${selectedRoute.method} ${selectedRoute.path}` : null}
              />
            ) : (
              <DiagnosticsProblemInspector
                finding={selectedFinding}
                facts={facts}
                route={inspectorRoute}
                matrixRow={inspectorMatrixRow}
                resolutionStatus={selectedResolutionStatus}
                onToggleResolved={toggleSelectedFindingResolved}
              />
            )
          }
        />
      ) : (
        <DiagnosticsProjectionTab
          tab={activeTab}
          blueprint={blueprint}
          findings={routeFindings}
          facts={facts}
        />
      )}
    </div>
  );
}
