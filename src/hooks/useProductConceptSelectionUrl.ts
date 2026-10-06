/**
 * URL-backed ProductConcept selection for Blueprint / Data / AppFlow (PU-15).
 * Location: src/hooks/useProductConceptSelectionUrl.ts
 */

import { useCallback, useEffect, useState } from "react";
import {
  createProductConceptSelection,
  productConceptSelectionFromSearchParams,
  productConceptSelectionToSearchParams,
  type ProductConceptSelection,
} from "../../shared/product-understanding/selection.js";

function readSelectionFromLocation(): ProductConceptSelection | null {
  if (typeof window === "undefined") return null;
  return productConceptSelectionFromSearchParams(new URLSearchParams(window.location.search));
}

function writeSelectionToLocation(selection: ProductConceptSelection | null): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (!selection) {
    url.searchParams.delete("puConcept");
    url.searchParams.delete("puEvidence");
    url.searchParams.delete("puView");
  } else {
    productConceptSelectionToSearchParams(selection, url.searchParams);
  }
  const next = `${url.pathname}${url.search}${url.hash}`;
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (next !== current) {
    window.history.replaceState({}, "", next);
  }
}

export interface ProductConceptSelectionApi {
  selection: ProductConceptSelection | null;
  setSelection: (
    conceptId: string | null,
    evidenceRefId?: string | null,
    viewHint?: string | null,
  ) => void;
  clearSelection: () => void;
}

export function useProductConceptSelectionUrl(): ProductConceptSelectionApi {
  const [selection, setSelectionState] = useState<ProductConceptSelection | null>(() =>
    readSelectionFromLocation(),
  );

  useEffect(() => {
    const onPopState = () => {
      setSelectionState(readSelectionFromLocation());
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const setSelection = useCallback(
    (conceptId: string | null, evidenceRefId?: string | null, viewHint?: string | null) => {
      if (!conceptId) {
        setSelectionState(null);
        writeSelectionToLocation(null);
        return;
      }
      const next = createProductConceptSelection(conceptId, evidenceRefId, viewHint);
      setSelectionState(next);
      writeSelectionToLocation(next);
    },
    [],
  );

  const clearSelection = useCallback(() => {
    setSelection(null);
  }, [setSelection]);

  return { selection, setSelection, clearSelection };
}

/** Preserve existing PU query params when navigating to a new path. */
export function pathWithCurrentPuQuery(path: string): string {
  if (typeof window === "undefined") return path;
  const target = new URL(path, window.location.origin);
  const current = new URLSearchParams(window.location.search);
  for (const key of ["puConcept", "puEvidence", "puView"] as const) {
    const value = current.get(key);
    if (value) target.searchParams.set(key, value);
    else target.searchParams.delete(key);
  }
  return `${target.pathname}${target.search}${target.hash}`;
}
