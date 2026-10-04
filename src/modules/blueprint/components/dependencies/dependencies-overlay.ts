/**
 * Overlay kind mapping for Dependencies — Security / API / Events.
 * Location: src/modules/blueprint/components/dependencies/dependencies-overlay.ts
 *
 * Overlays are additive: they union into the chip-selected kinds and never
 * replace the primary topology filter set (PR-08).
 */

import type { DependencyEdgeKind } from "./_projection.constants.js";

export type DependencyOverlayId = "security" | "api" | "events";

const OVERLAY_KINDS: Record<DependencyOverlayId, readonly DependencyEdgeKind[]> = {
  security: ["auth", "validation"],
  api: ["api", "calls"],
  events: ["event"],
};

/** Kinds contributed by active overlays (empty set when none active). */
export function kindsForOverlays(overlays: Set<DependencyOverlayId>): Set<DependencyEdgeKind> {
  const kinds = new Set<DependencyEdgeKind>();
  for (const overlay of overlays) {
    for (const kind of OVERLAY_KINDS[overlay]) kinds.add(kind);
  }
  return kinds;
}

/** Union chip selection with overlay kinds (overlays never replace primary). */
export function mergeVisibleKindsWithOverlays(
  visibleEdgeKinds: Set<DependencyEdgeKind>,
  overlays: Set<DependencyOverlayId>,
): Set<DependencyEdgeKind> {
  const merged = new Set(visibleEdgeKinds);
  for (const kind of kindsForOverlays(overlays)) merged.add(kind);
  return merged;
}

export const OVERLAY_LABELS: Record<DependencyOverlayId, string> = {
  security: "Security (Auth/Validation)",
  api: "API / Calls",
  events: "Events",
};
