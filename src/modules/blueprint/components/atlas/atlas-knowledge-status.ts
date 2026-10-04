/**
 * Atlas KnowledgeStatus display helpers (PR-06).
 * Location: src/modules/blueprint/components/atlas/atlas-knowledge-status.ts
 */

import type { KnowledgeStatus } from "../../../../../shared/scan-detector/epistemic.js";

export type AtlasKnowledgeTone = "strong" | "weak" | "conflict";

const LABELS: Record<KnowledgeStatus, string> = {
  VERIFIED: "Verifiziert",
  SUPPORTED: "Gestützt",
  INTERPRETED: "Interpretiert",
  UNKNOWN: "Unbekannt",
  CONFLICTED: "Konflikt",
};

export function atlasKnowledgeStatusLabel(status: KnowledgeStatus | string | undefined): string {
  if (!status) return "Unbekannt";
  return LABELS[status as KnowledgeStatus] ?? String(status);
}

/** Strong (VERIFIED/SUPPORTED) vs weak (INTERPRETED/UNKNOWN) vs conflict. */
export function atlasKnowledgeTone(
  status: KnowledgeStatus | string | undefined,
): AtlasKnowledgeTone {
  if (status === "CONFLICTED") return "conflict";
  if (status === "VERIFIED" || status === "SUPPORTED") return "strong";
  return "weak";
}

export function isWeakKnowledgeStatus(status: KnowledgeStatus | string | undefined): boolean {
  return atlasKnowledgeTone(status) === "weak";
}
