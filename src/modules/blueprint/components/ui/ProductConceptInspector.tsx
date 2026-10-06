/**
 * Maps Product Concept explanation sections into Blueprint InspectorPanel sections.
 * No business inference — presenter is the sole content source.
 * Location: src/modules/blueprint/components/ui/ProductConceptInspector.tsx
 */

import {
  knowledgeStatusLabelDe,
  type ProductConceptExplanationView,
} from "../../../../../shared/product-understanding/explanation-presenter.js";
import { buildProductConceptInspectorSections } from "../../../../../shared/product-understanding/inspector-sections.js";
import type { KnowledgeStatus } from "../../../../../shared/scan-detector/epistemic.js";
import type { InspectorSection } from "./InspectorPanel.js";
import { StatusBadge, type StatusBadgeVariant } from "./StatusBadge.js";

function statusVariant(status: KnowledgeStatus): StatusBadgeVariant {
  switch (status) {
    case "VERIFIED":
    case "SUPPORTED":
      return "confirmed";
    case "CONFLICTED":
      return "critical";
    case "INTERPRETED":
      return "warning";
    default:
      return "unknown";
  }
}

export function productConceptStatusBadge(view: ProductConceptExplanationView): JSX.Element {
  return (
    <StatusBadge
      variant={statusVariant(view.knowledgeStatus)}
      label={knowledgeStatusLabelDe(view.knowledgeStatus)}
      testId="product-concept-status-badge"
    />
  );
}

/** Build InspectorPanel sections from a shared explanation view. */
export function productConceptInspectorSections(
  view: ProductConceptExplanationView,
): InspectorSection[] {
  return buildProductConceptInspectorSections(view).map((section) => ({
    id: section.id,
    title: section.title,
    content: <p>{section.body}</p>,
  }));
}
