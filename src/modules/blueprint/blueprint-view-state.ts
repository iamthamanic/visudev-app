/**
 * Resolve Honest-Core ViewState for a Blueprint view (P1-4).
 * Location: src/modules/blueprint/blueprint-view-state.ts
 */

import type { ScanStatus } from "../../lib/visudev/types.js";
import type { ViewStateName } from "../../components/ui/ViewState.js";

export interface BlueprintViewScanProps {
  scanStatus?: ScanStatus;
  scanError?: string | null;
  onRetry?: () => void;
}

export const VIEW_NOTHING_FOUND_DETAIL: Record<string, string> = {
  atlas:
    "Analyse abgeschlossen, keine Systemübersicht. Gesucht nach: Systemen, Services, Modulen und Datei-Clustern.",
  architecture:
    "Analyse abgeschlossen, keine Architektur-Gruppen. Gesucht nach: Domain-Zuordnung in den Modul-Pfaden, Schichten und Modulen.",
  dependencies:
    "Analyse abgeschlossen, keine Abhängigkeiten. Gesucht nach: Import-, Call-, API-, Event- und Data-Kanten.",
  execution:
    "Analyse abgeschlossen, keine Ausführungspipeline. Gesucht nach: Pipeline-Schritten und gemessenen Timings.",
  infrastructure:
    "Analyse abgeschlossen, keine Infrastruktur. Gesucht nach: Runtime-, Service- und Database-Knoten.",
  diagnostics:
    "Analyse abgeschlossen, keine Befunde. Gesucht nach: Security-, Coverage-, Qualitäts-Mustern.",
  evolution:
    "Analyse abgeschlossen, keine Evolution. Gesucht nach: Git-Commits und Snapshot-Diffs.",
};

export function resolveBlueprintViewState(options: {
  scanStatus?: ScanStatus;
  hasViewData: boolean;
}): Exclude<ViewStateName, "partial-scan"> | null {
  const status = options.scanStatus ?? (options.hasViewData ? "completed" : "idle");
  if (status === "running") return "loading";
  if (status === "failed") return "error";
  if (options.hasViewData) return null;
  if (status === "completed") return "nothing-found";
  return "not-scanned";
}

export function viewStateCopy(
  name: Exclude<ViewStateName, "partial-scan">,
  viewId: string,
  scanError?: string | null,
): { title: string; detail: string } {
  if (name === "loading") {
    return {
      title: "Analyse läuft",
      detail: "Blueprint wird gerade erzeugt. Dieser View füllt sich, sobald der Scan fertig ist.",
    };
  }
  if (name === "error") {
    return {
      title: "Analyse fehlgeschlagen",
      detail: scanError?.trim() || "Kein Fehlertext vom Analyzer.",
    };
  }
  if (name === "not-scanned") {
    return {
      title: "Noch nicht analysiert",
      detail: "Für dieses Projekt bzw. diesen Branch liegt noch kein Blueprint-Scan vor.",
    };
  }
  return {
    title: "Nichts gefunden",
    detail:
      VIEW_NOTHING_FOUND_DETAIL[viewId] ?? "Analyse abgeschlossen, keine Daten für diesen View.",
  };
}
