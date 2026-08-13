/**
 * Blueprint view shell — renders active projection without horizontal tabs (#86).
 */

import { useEffect, useState } from "react";
import { GlossaryDrawer } from "../../../components/ui/GlossaryDrawer.js";
import { ArchitectureView } from "./ArchitectureView";
import { AtlasView } from "./AtlasView";
import { BlueprintViewHeader } from "./BlueprintViewHeader.js";
import { DependenciesView } from "./DependenciesView";
import { DiagnosticsView } from "./DiagnosticsView";
import { EvolutionView } from "./EvolutionView";
import { ExecutionView } from "./ExecutionView";
import { InfrastructureView } from "./InfrastructureView";
import type { BlueprintShellViewId } from "../blueprint-view-config.js";
import type { BlueprintData } from "../types";
import type { BlueprintViewScanProps } from "../blueprint-view-state.js";
import styles from "../styles/BlueprintViewShell.module.css";

interface BlueprintViewShellProps extends BlueprintViewScanProps {
  blueprint: BlueprintData;
  projectId?: string;
  activeView: BlueprintShellViewId;
  projectName?: string;
  branchLabel?: string;
}

export function BlueprintViewShell({
  blueprint,
  projectId,
  activeView,
  projectName,
  branchLabel,
  scanStatus,
  scanError,
  onRetry,
}: BlueprintViewShellProps): JSX.Element {
  const [glossaryOpen, setGlossaryOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      const typing =
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);
      if (event.key === "Escape") {
        setGlossaryOpen(false);
        return;
      }
      if (event.key === "?" && !typing) {
        event.preventDefault();
        setGlossaryOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className={styles.root} data-testid="blueprint-view">
      <BlueprintViewHeader
        activeView={activeView}
        projectName={projectName}
        branchLabel={branchLabel}
        onOpenGlossary={() => setGlossaryOpen(true)}
      />

      <div className={styles.panel}>
        <div
          className={styles.panelContent}
          role="region"
          aria-label={activeView}
          data-testid="blueprint-main-content"
        >
          {activeView === "infrastructure" ? (
            <InfrastructureView
              blueprint={blueprint}
              scanStatus={scanStatus}
              scanError={scanError}
              onRetry={onRetry}
            />
          ) : activeView === "architecture" ? (
            <ArchitectureView
              blueprint={blueprint}
              scanStatus={scanStatus}
              scanError={scanError}
              onRetry={onRetry}
            />
          ) : activeView === "dependencies" ? (
            <DependenciesView
              blueprint={blueprint}
              scanStatus={scanStatus}
              scanError={scanError}
              onRetry={onRetry}
            />
          ) : activeView === "execution" ? (
            <ExecutionView
              blueprint={blueprint}
              scanStatus={scanStatus}
              scanError={scanError}
              onRetry={onRetry}
            />
          ) : activeView === "evolution" ? (
            <EvolutionView
              blueprint={blueprint}
              projectId={projectId}
              scanStatus={scanStatus}
              scanError={scanError}
              onRetry={onRetry}
            />
          ) : activeView === "atlas" ? (
            <AtlasView
              blueprint={blueprint}
              scanStatus={scanStatus}
              scanError={scanError}
              onRetry={onRetry}
            />
          ) : (
            <DiagnosticsView
              blueprint={blueprint}
              scanStatus={scanStatus}
              scanError={scanError}
              onRetry={onRetry}
            />
          )}
        </div>
      </div>
      <GlossaryDrawer open={glossaryOpen} onClose={() => setGlossaryOpen(false)} />
    </div>
  );
}
