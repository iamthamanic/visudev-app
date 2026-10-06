/**
 * Shared Blueprint ProductConcept selection provider (PU-15).
 * Location: src/modules/blueprint/context/BlueprintProductSelectionContext.tsx
 */

import type { ReactNode } from "react";
import { useProductConceptSelectionUrl } from "../../../hooks/useProductConceptSelectionUrl.js";
import { BlueprintProductSelectionContext } from "./blueprint-product-selection-context.js";

export function BlueprintProductSelectionProvider({ children }: { children: ReactNode }) {
  const api = useProductConceptSelectionUrl();
  return (
    <BlueprintProductSelectionContext.Provider value={api}>
      {children}
    </BlueprintProductSelectionContext.Provider>
  );
}
