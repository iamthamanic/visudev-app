import { useEffect, useState } from "react";
import type { AtlasViewMode } from "./atlas-view-mode.js";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion.js";

export interface AtlasViewModeState {
  viewMode: AtlasViewMode;
  threeDisabled: boolean;
  handleSelectViewMode: (mode: AtlasViewMode) => void;
}

export function useAtlasViewModeState(): AtlasViewModeState {
  const threeDisabled = usePrefersReducedMotion();
  const [viewMode, setViewMode] = useState<AtlasViewMode>(() =>
    threeDisabled ? "2d" : "3d",
  );

  useEffect(() => setViewMode(threeDisabled ? "2d" : "3d"), [threeDisabled]);

  const handleSelectViewMode = (mode: AtlasViewMode): void => {
    if (mode === "3d" && threeDisabled) return;
    setViewMode(mode);
  };

  return { viewMode, threeDisabled, handleSelectViewMode };
}
