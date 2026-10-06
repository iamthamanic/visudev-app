/**
 * Hook for Blueprint ProductConcept selection context (PU-15).
 * Location: src/modules/blueprint/context/useBlueprintProductSelection.ts
 */

import { useContext } from "react";
import type { ProductConceptSelectionApi } from "../../../hooks/useProductConceptSelectionUrl.js";
import { BlueprintProductSelectionContext } from "./blueprint-product-selection-context.js";

export function useBlueprintProductSelection(): ProductConceptSelectionApi {
  const ctx = useContext(BlueprintProductSelectionContext);
  if (!ctx) {
    return {
      selection: null,
      setSelection: () => undefined,
      clearSelection: () => undefined,
    };
  }
  return ctx;
}
