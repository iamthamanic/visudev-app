/**
 * Overlay kind mapping for Dependencies Security / API / Events filters.
 * Location: src/modules/blueprint/components/dependencies/dependencies-overlay.ts
 */

import type { DependencyEdgeKind } from "./_projection.constants.js";

export type DependencyOverlayId = "security" | "api" | "events";

const OVERLAY_KINDS: Record<DependencyOverlayId, readonly DependencyEdgeKind[]> = {
  security: ["auth", "validation"],
  api: ["api", "calls"],
  events: ["event"],
};

export function kindsForOverlays(
  overlays: Set<DependencyOverlayId>,
): Set<DependencyEdgeKind> | null {
  if (overlays.size === 0) return null;
  const kinds = new Set<DependencyEdgeKind>();
  for (const overlay of overlays) {
    for (const kind of OVERLAY_KINDS[overlay]) kinds.add(kind);
  }
  return kinds;
}

export const OVERLAY_LABELS: Record<DependencyOverlayId, string> = {
  security: "Security",
  api: "API",
  events: "Events",
};
