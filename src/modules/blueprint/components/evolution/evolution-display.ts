/**
 * Safe display helpers for external snapshot/git strings in Evolution UI.
 */
import { formatAnalysisOriginLabel } from "../../../../lib/visudev/analysis-origin-display.js";
import type { SoftwareGraphSnapshot } from "../../types";

export function formatSnapshotDate(capturedAt: string | undefined): string {
  if (!capturedAt || capturedAt.length < 10) return "—";
  const isoDate = capturedAt.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(isoDate) ? isoDate : "—";
}

export function displayText(value: string | undefined, maxLength = 120): string {
  if (!value?.trim()) return "—";
  const trimmed = value.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength - 1)}…`;
}

export function formatCommitSha(sha: string | undefined): string {
  if (!sha || sha.length < 8) return "—";
  return sha.slice(0, 8);
}

export function formatSnapshotOrigin(snapshot: SoftwareGraphSnapshot): string {
  if (snapshot.sourceKind === "git" || snapshot.sourceKind === "filesystem") {
    return formatAnalysisOriginLabel(snapshot);
  }
  return displayText(snapshot.label);
}

export function snapshotOriginHelp(snapshot: SoftwareGraphSnapshot): string | undefined {
  if (!snapshot.dirty) return undefined;
  return "Du hast Dateien geändert, aber noch nicht in Git gespeichert. Diese Analyse zeigt deinen aktuellen Stand, nicht den letzten Commit.";
}
