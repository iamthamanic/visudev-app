/**
 * Shared display helpers for analysis/git provenance labels (Evolution + Local Engine).
 */

import type { AnalysisOrigin } from "./software-graph.types.js";

export interface OriginDisplayInput {
  sourceKind?: AnalysisOrigin["sourceKind"];
  commitSha?: string;
  branch?: string;
  dirty?: boolean;
  capturedAt: string;
  label?: string;
}

function displayText(value: string | undefined, maxLength = 120): string {
  if (!value?.trim()) return "—";
  const trimmed = value.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength - 1)}…`;
}

function formatFilesystemCapturedAt(capturedAt: string): string {
  const parsed = Date.parse(capturedAt);
  if (!Number.isFinite(parsed)) return "Kein Git-Repository";
  const date = new Date(parsed);
  if (Number.isNaN(date.getTime())) return "Kein Git-Repository";
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const year = String(date.getUTCFullYear());
  const hour = String(date.getUTCHours()).padStart(2, "0");
  const minute = String(date.getUTCMinutes()).padStart(2, "0");
  const second = String(date.getUTCSeconds()).padStart(2, "0");
  return `Kein Git-Repository · Stand ${day}.${month}.${year} ${hour}:${minute}:${second}`;
}

/** German UI label for git/filesystem analysis origin. */
export function formatAnalysisOriginLabel(origin: OriginDisplayInput): string {
  if (origin.sourceKind === "git" && origin.commitSha) {
    const branch = origin.branch ? `Branch ${displayText(origin.branch)}` : "kein Branch";
    const dirty = origin.dirty ? " · ungespeicherte Änderungen" : "";
    return `Commit ${displayText(origin.commitSha, 64)} · ${branch}${dirty}`;
  }
  if (origin.sourceKind === "filesystem") {
    return formatFilesystemCapturedAt(origin.capturedAt);
  }
  if (origin.label) {
    return displayText(origin.label);
  }
  return "—";
}
