/**
 * Cross-view ProductConcept focus + evidence target resolution (PU-15).
 * Keeps stable concept ids; never invents substitute mappings.
 * Location: shared/product-understanding/cross-view-selection.ts
 */

import type {
  ProductConcept,
  ProductEvidenceRef,
  ProductUnderstandingModel,
} from "../product-understanding.types.js";
import {
  resolveProductConceptSelectionForView,
  type ProductConceptSelection,
} from "./selection.js";

export type CrossViewSurfaceId =
  | "atlas"
  | "architecture"
  | "dependencies"
  | "execution"
  | "infrastructure"
  | "diagnostics"
  | "evolution"
  | "data"
  | "appflow";

export const CONCEPT_NOT_IN_VIEW_MESSAGE_DE =
  "Auswahl vorhanden, aber in dieser View nicht direkt abgebildet";

export interface CrossViewFocusResult {
  selection: ProductConceptSelection;
  presentInView: boolean;
  /** Local focus id for the active surface (may differ for execution stories). */
  viewLocalId: string | null;
  messageDe: string | null;
}

export interface EvidenceNavigationTarget {
  evidence: ProductEvidenceRef;
  label: string;
  surface: "code" | "data" | "appflow";
}

/** Execution stories use `pu-story:<user-action-concept-id>`. */
export function executionStoryIdForConcept(conceptId: string): string {
  return `pu-story:${conceptId}`;
}

export function conceptIdFromExecutionStoryId(storyId: string): string | null {
  if (!storyId.startsWith("pu-story:")) return null;
  const conceptId = storyId.slice("pu-story:".length);
  return conceptId.startsWith("pu:") ? conceptId : null;
}

export function resolveCrossViewFocus(
  selection: ProductConceptSelection,
  surface: CrossViewSurfaceId,
  availableConceptIds: readonly string[],
): CrossViewFocusResult {
  if (surface === "diagnostics") {
    return {
      selection,
      presentInView: false,
      viewLocalId: null,
      messageDe: CONCEPT_NOT_IN_VIEW_MESSAGE_DE,
    };
  }

  if (surface === "execution") {
    const storyId = executionStoryIdForConcept(selection.conceptId);
    const hasStory = availableConceptIds.includes(storyId);
    const hasConcept = availableConceptIds.includes(selection.conceptId);
    const presentInView = hasStory || hasConcept;
    return {
      selection,
      presentInView,
      viewLocalId: hasStory ? storyId : hasConcept ? selection.conceptId : null,
      messageDe: presentInView ? null : CONCEPT_NOT_IN_VIEW_MESSAGE_DE,
    };
  }

  const { presentInView } = resolveProductConceptSelectionForView(selection, availableConceptIds);

  return {
    selection,
    presentInView,
    viewLocalId: presentInView ? selection.conceptId : null,
    messageDe: presentInView ? null : CONCEPT_NOT_IN_VIEW_MESSAGE_DE,
  };
}

export function listSoftwareGraphEvidence(
  concept: ProductConcept | undefined,
): ProductEvidenceRef[] {
  if (!concept) return [];
  return concept.evidence.filter((item) => item.source === "software-graph" && item.refId.trim());
}

export function listUiInteractionEvidence(
  concept: ProductConcept | undefined,
): ProductEvidenceRef[] {
  if (!concept) return [];
  return concept.evidence.filter(
    (item) => item.source === "ui-interaction-graph" && item.refId.trim(),
  );
}

export function listDataLineageEvidence(concept: ProductConcept | undefined): ProductEvidenceRef[] {
  if (!concept) return [];
  return concept.evidence.filter((item) => item.source === "data-lineage" && item.refId.trim());
}

/**
 * Evidence-backed navigation targets only — never invent joins.
 * Multiple targets stay listed for an explicit chooser.
 */
export function listEvidenceNavigationTargets(
  model: ProductUnderstandingModel,
  conceptId: string,
): EvidenceNavigationTarget[] {
  const concept = model.concepts.find((item) => item.id === conceptId);
  if (!concept) return [];

  const targets: EvidenceNavigationTarget[] = [];
  for (const evidence of listSoftwareGraphEvidence(concept)) {
    targets.push({
      evidence,
      label: evidence.summary?.trim() || evidence.refId,
      surface: "code",
    });
  }
  for (const evidence of listDataLineageEvidence(concept)) {
    targets.push({
      evidence,
      label: evidence.summary?.trim() || evidence.refId,
      surface: "data",
    });
  }
  for (const evidence of listUiInteractionEvidence(concept)) {
    targets.push({
      evidence,
      label: evidence.summary?.trim() || evidence.refId,
      surface: "appflow",
    });
  }
  return targets;
}

export function pickPreferredGraphNodeId(
  model: ProductUnderstandingModel,
  selection: ProductConceptSelection,
  presentNodeIds?: ReadonlySet<string> | null,
): string | null {
  const concept = model.concepts.find((item) => item.id === selection.conceptId);
  const evidence = listSoftwareGraphEvidence(concept);
  if (evidence.length === 0) return null;

  if (selection.evidenceRefId) {
    const match = evidence.find((item) => item.refId === selection.evidenceRefId);
    if (match) return match.refId;
  }

  if (evidence.length === 1) return evidence[0]!.refId;

  if (!presentNodeIds || presentNodeIds.size === 0) return null;
  const present = evidence.filter((item) => presentNodeIds.has(item.refId));
  if (present.length === 1) return present[0]!.refId;
  return null;
}
