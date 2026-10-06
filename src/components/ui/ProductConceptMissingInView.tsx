/**
 * Neutral banner when a ProductConcept selection is not represented in the active view (PU-15).
 * Location: src/components/ui/ProductConceptMissingInView.tsx
 */

import { CONCEPT_NOT_IN_VIEW_MESSAGE_DE } from "../../../shared/product-understanding/cross-view-selection.js";
import type { ProductConceptSelection } from "../../../shared/product-understanding/selection.js";
import styles from "./ProductConceptMissingInView.module.css";

export interface ProductConceptMissingInViewProps {
  selection: ProductConceptSelection;
  messageDe?: string | null;
}

export function ProductConceptMissingInView({
  selection,
  messageDe,
}: ProductConceptMissingInViewProps): JSX.Element {
  return (
    <div
      className={styles.root}
      role="status"
      data-testid="product-concept-missing-in-view"
      data-concept-id={selection.conceptId}
    >
      <p className={styles.message}>{messageDe ?? CONCEPT_NOT_IN_VIEW_MESSAGE_DE}</p>
      <p className={styles.meta}>Auswahl bleibt erhalten: {selection.conceptId}</p>
    </div>
  );
}
