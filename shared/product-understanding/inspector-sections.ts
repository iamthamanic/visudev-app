/**
 * Shared inspector section data for Product Concept explanations (PU-04).
 * Pure data — Blueprint maps these into InspectorPanel sections.
 * Location: shared/product-understanding/inspector-sections.ts
 */

import type { ProductConceptExplanationView } from "./explanation-presenter.js";

export interface ProductConceptInspectorSectionData {
  id: string;
  title: string;
  /** Plain text body — UI renders without re-formatting business meaning. */
  body: string;
}

/**
 * Standard inspector sections: purpose → why → impact → status → evidence.
 * Titles are German to match product UI locale.
 */
export function buildProductConceptInspectorSections(
  view: ProductConceptExplanationView,
): ProductConceptInspectorSectionData[] {
  return [
    {
      id: "purpose",
      title: view.level1.title,
      body: view.level1.body,
    },
    {
      id: "why-it-matters",
      title: "Warum ist das wichtig?",
      body: view.whyItMatters,
    },
    {
      id: "system",
      title: view.level2.title,
      body: view.level2.body,
    },
    {
      id: "impact",
      title: "Impact",
      body: view.impactSummary,
    },
    {
      id: "status",
      title: "Knowledge-Status",
      body: view.isConfirmed
        ? `${view.statusLabel} — belastbare Aussage.`
        : `${view.statusLabel} — nicht als bestätigt formulieren.`,
    },
    {
      id: "evidence",
      title: view.level3.title,
      body: view.level3.body,
    },
  ];
}
