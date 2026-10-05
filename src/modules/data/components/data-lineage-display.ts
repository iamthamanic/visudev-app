/**
 * German display labels for canonical DataLineage fields (PR-22).
 * Status/evidence come from the model — this module only maps strings for UI.
 * Location: src/modules/data/components/data-lineage-display.ts
 */

import type { DataLineageLayer, LineagePathStatus } from "../../../../shared/data-lineage.types.js";
import type { KnowledgeStatus } from "../../../../shared/scan-detector/epistemic.js";

const PATH_STATUS_LABELS: Record<LineagePathStatus, string> = {
  complete: "Vollständig",
  partial: "Teilweise",
  unresolved: "Ungeklärt",
};

const LAYER_LABELS: Record<DataLineageLayer, string> = {
  "ui-surface": "UI-Oberfläche",
  "ui-interaction": "UI-Interaktion",
  endpoint: "Endpoint",
  "service-module": "Service/Modul",
  "data-entity": "Daten-Entity",
};

const KNOWLEDGE_LABELS: Record<KnowledgeStatus, string> = {
  VERIFIED: "Verifiziert",
  SUPPORTED: "Gestützt",
  INTERPRETED: "Interpretiert",
  UNKNOWN: "Unbekannt",
  CONFLICTED: "Konflikt",
};

export function lineagePathStatusLabel(status: LineagePathStatus | string | undefined): string {
  if (!status) return "Unbekannt";
  return PATH_STATUS_LABELS[status as LineagePathStatus] ?? String(status);
}

export function lineageLayerLabel(layer: DataLineageLayer | string | undefined): string {
  if (!layer) return "Unbekannt";
  return LAYER_LABELS[layer as DataLineageLayer] ?? String(layer);
}

export function lineageKnowledgeStatusLabel(status: KnowledgeStatus | string | undefined): string {
  if (!status) return "Unbekannt";
  return KNOWLEDGE_LABELS[status as KnowledgeStatus] ?? String(status);
}

export function lineageDirectionLabel(direction: "forward" | "reverse"): string {
  return direction === "forward" ? "Forward Lineage" : "Reverse Impact";
}
