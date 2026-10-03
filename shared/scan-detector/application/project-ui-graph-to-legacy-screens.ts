/**
 * Project UIInteractionGraph → legacy Screen[] for AppFlow compatibility (SDE-10).
 * Location: shared/scan-detector/application/project-ui-graph-to-legacy-screens.ts
 */

import type {
  LegacyScreenLike,
  LegacyScreenType,
  LegacyStateTarget,
  UiInteractionGraph,
  UiSurface,
  UiSurfaceKind,
  UiTransition,
} from "../../ui-interaction-graph.types.js";

function legacyTypeFromSurface(kind: UiSurfaceKind): LegacyScreenType {
  switch (kind) {
    case "page":
      return "page";
    case "screen":
      return "screen";
    case "view":
    case "window":
      return "view";
    case "modal":
    case "drawer":
    case "popover":
      return "modal";
    case "tab":
      return "tab";
    case "menu":
      return "dropdown";
    default:
      return "screen";
  }
}

function legacyScreenId(surface: UiSurface): string {
  const legacy = surface.attributes?.legacyScreenId;
  if (typeof legacy === "string" && legacy.length > 0) return legacy;
  return surface.id.replace(/^ui:surface:/, "");
}

function edgeTypeFromTransition(
  transition: UiTransition,
): LegacyStateTarget["edgeType"] | "navigate" | null {
  if (transition.kind === "navigate") return "navigate";
  if (transition.kind === "switch-tab") return "switch-tab";
  if (transition.kind === "menu-action") return "dropdown-action";
  if (transition.kind === "open-surface") return "open-modal";
  return null;
}

/**
 * Compatibility projection — AppFlow may keep consuming Screen[] until cutover.
 */
export function projectUiGraphToLegacyScreens(graph: UiInteractionGraph): LegacyScreenLike[] {
  const surfaceById = new Map(graph.surfaces.map((surface) => [surface.id, surface]));
  const screens: LegacyScreenLike[] = graph.surfaces.map((surface) => {
    const id = legacyScreenId(surface);
    const parent = surface.parentSurfaceId ? surfaceById.get(surface.parentSurfaceId) : undefined;
    return {
      id,
      name: surface.label,
      path: surface.path ?? "/",
      filePath: surface.filePath,
      type: legacyTypeFromSurface(surface.kind),
      framework: surface.framework,
      parentScreenId: parent ? legacyScreenId(parent) : undefined,
      parentPath: parent?.path,
      stateKey: surface.stateKey,
      navigatesTo: [],
      stateTargets: [],
    };
  });

  const screenById = new Map(screens.map((screen) => [screen.id, screen]));

  for (const transition of graph.transitions) {
    const fromSurface = surfaceById.get(transition.fromSurfaceId);
    const toSurface = surfaceById.get(transition.toSurfaceId);
    if (!fromSurface || !toSurface) continue;
    const from = screenById.get(legacyScreenId(fromSurface));
    const toId = legacyScreenId(toSurface);
    if (!from) continue;

    const edgeType = edgeTypeFromTransition(transition);
    if (edgeType === "navigate") {
      from.navigatesTo = [...(from.navigatesTo ?? []), toId];
      continue;
    }
    if (!edgeType) continue;
    from.stateTargets = [
      ...(from.stateTargets ?? []),
      {
        targetScreenId: toId,
        edgeType,
        trigger: transition.trigger
          ? {
              label: transition.trigger.label,
              selector: transition.trigger.selector,
              testId: transition.trigger.testId,
              file: transition.trigger.filePath,
              line: transition.trigger.line,
              confidence: transition.confidence,
            }
          : undefined,
      },
    ];
  }

  return screens;
}
