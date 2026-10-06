import { useState } from "react";
import type { AtlasViewMode } from "./atlas-view-mode.js";

export interface AtlasViewModeState {
  viewMode: AtlasViewMode;
  /** Always true for Product-Understanding Atlas — 3D is not a primary path (PU-07). */
  threeDisabled: boolean;
  handleSelectViewMode: (mode: AtlasViewMode) => void;
}

/**
 * Product-Understanding Atlas is 2D-only as the required path.
 * 3D city mode is retired from the primary UX (code may remain lazy-loadable elsewhere).
 */
export function useAtlasViewModeState(): AtlasViewModeState {
  const [viewMode, setViewMode] = useState<AtlasViewMode>("2d");

  const handleSelectViewMode = (mode: AtlasViewMode): void => {
    // Ignore 3D — Product Understanding Atlas stays fully operable in 2D.
    if (mode === "3d") return;
    setViewMode("2d");
  };

  return { viewMode, threeDisabled: true, handleSelectViewMode };
}
