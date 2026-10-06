/**
 * React context object for Blueprint ProductConcept selection (PU-15).
 * Location: src/modules/blueprint/context/blueprint-product-selection-context.ts
 */

import { createContext } from "react";
import type { ProductConceptSelectionApi } from "../../../hooks/useProductConceptSelectionUrl.js";

export const BlueprintProductSelectionContext = createContext<ProductConceptSelectionApi | null>(
  null,
);
