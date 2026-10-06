/**
 * Stable Product Concept selection + URL/query serialization (PU-04 / #425).
 * Transport conceptId (+ optional evidence) without view-specific business IDs.
 * Location: shared/product-understanding/selection.ts
 */

export const PU_SELECTION_QUERY_CONCEPT = "puConcept";
export const PU_SELECTION_QUERY_EVIDENCE = "puEvidence";
export const PU_SELECTION_QUERY_VIEW = "puView";

export interface ProductConceptSelection {
  /** Canonical Product Concept id (`pu:<kind>:<key>`). */
  conceptId: string;
  /** Optional evidence ref within that concept. */
  evidenceRefId?: string | null;
  /**
   * Optional Blueprint view hint for restore — not authoritative identity.
   * Target view may ignore if concept is not projected there.
   */
  viewHint?: string | null;
}

const CONCEPT_ID_RE = /^pu:[a-z0-9-]+:[a-z0-9._/-]+$/i;

export function isProductConceptSelectionId(value: string): boolean {
  return CONCEPT_ID_RE.test(value.trim());
}

export function createProductConceptSelection(
  conceptId: string,
  evidenceRefId?: string | null,
  viewHint?: string | null,
): ProductConceptSelection | null {
  const id = conceptId.trim();
  if (!isProductConceptSelectionId(id)) return null;
  return {
    conceptId: id,
    evidenceRefId: evidenceRefId?.trim() || null,
    viewHint: viewHint?.trim() || null,
  };
}

/** Compact token for localStorage / routing helpers. */
export function serializeProductConceptSelection(selection: ProductConceptSelection): string {
  const parts = [selection.conceptId];
  if (selection.evidenceRefId) parts.push(`e=${selection.evidenceRefId}`);
  if (selection.viewHint) parts.push(`v=${selection.viewHint}`);
  return parts.join("|");
}

export function parseProductConceptSelection(
  raw: string | null | undefined,
): ProductConceptSelection | null {
  if (!raw || !raw.trim()) return null;
  const [conceptId, ...rest] = raw.trim().split("|");
  if (!conceptId || !isProductConceptSelectionId(conceptId)) return null;
  let evidenceRefId: string | null = null;
  let viewHint: string | null = null;
  for (const part of rest) {
    if (part.startsWith("e=")) evidenceRefId = part.slice(2) || null;
    if (part.startsWith("v=")) viewHint = part.slice(2) || null;
  }
  return { conceptId, evidenceRefId, viewHint };
}

export function productConceptSelectionToSearchParams(
  selection: ProductConceptSelection,
  params: URLSearchParams = new URLSearchParams(),
): URLSearchParams {
  params.set(PU_SELECTION_QUERY_CONCEPT, selection.conceptId);
  if (selection.evidenceRefId) {
    params.set(PU_SELECTION_QUERY_EVIDENCE, selection.evidenceRefId);
  } else {
    params.delete(PU_SELECTION_QUERY_EVIDENCE);
  }
  if (selection.viewHint) {
    params.set(PU_SELECTION_QUERY_VIEW, selection.viewHint);
  } else {
    params.delete(PU_SELECTION_QUERY_VIEW);
  }
  return params;
}

export function productConceptSelectionFromSearchParams(
  params: URLSearchParams,
): ProductConceptSelection | null {
  const conceptId = params.get(PU_SELECTION_QUERY_CONCEPT)?.trim() ?? "";
  if (!isProductConceptSelectionId(conceptId)) return null;
  return {
    conceptId,
    evidenceRefId: params.get(PU_SELECTION_QUERY_EVIDENCE)?.trim() || null,
    viewHint: params.get(PU_SELECTION_QUERY_VIEW)?.trim() || null,
  };
}

/**
 * When the target view has no direct projection for the concept, keep the
 * selection descriptor (caller shows empty/hint) — never invent a substitute id.
 */
export function resolveProductConceptSelectionForView(
  selection: ProductConceptSelection,
  availableConceptIds: readonly string[],
): { selection: ProductConceptSelection; presentInView: boolean } {
  const presentInView = availableConceptIds.includes(selection.conceptId);
  return { selection, presentInView };
}
