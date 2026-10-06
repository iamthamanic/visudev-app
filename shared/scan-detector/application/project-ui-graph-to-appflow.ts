/**
 * Project UIInteractionGraph → AppFlow screens + transition edges (SDE-11).
 * Preserves navigate / open / close / switch / menu transitions (no drop).
 * Location: shared/scan-detector/application/project-ui-graph-to-appflow.ts
 */

import type {
  LegacyScreenLike,
  UiInteractionGraph,
  UiKnowledgeStatus,
  UiTransitionKind,
} from "../../ui-interaction-graph.types.js";
import { normalizeUiTrigger } from "./normalize-ui-trigger.js";
import { projectUiGraphToLegacyScreens } from "./project-ui-graph-to-legacy-screens.js";

export type AppflowProjectionEdgeType =
  | "navigate"
  | "open-modal"
  | "close-surface"
  | "switch-tab"
  | "dropdown-action"
  | "menu-action";

export interface AppflowProjectionEdge {
  fromId: string;
  toId: string;
  type: AppflowProjectionEdgeType;
  targetPath?: string;
  trigger?: {
    label?: string;
    selector?: string;
    testId?: string;
    file?: string;
    line?: number;
    confidence?: number;
  };
  /** Epistemic status from engine — never inflate to verified. */
  status: UiKnowledgeStatus;
  confidence: number;
  /** Safe display label for edge controls; "unknown" when no evidenced trigger. */
  triggerDisplay?: string;
  triggerUnknown?: boolean;
}

export interface AppflowProjectionModel {
  screens: LegacyScreenLike[];
  edges: AppflowProjectionEdge[];
  /** legacyScreenId → surface status */
  surfaceStatusByScreenId: Record<string, UiKnowledgeStatus>;
  surfaceConfidenceByScreenId: Record<string, number>;
}

function edgeTypeFromTransition(kind: UiTransitionKind): AppflowProjectionEdgeType | null {
  switch (kind) {
    case "navigate":
      return "navigate";
    case "open-surface":
      return "open-modal";
    case "close-surface":
      return "close-surface";
    case "switch-tab":
      return "switch-tab";
    case "menu-action":
      return "menu-action";
    default:
      return null;
  }
}

function legacyIdFromSurfaceId(
  surfaceId: string,
  screens: readonly LegacyScreenLike[],
  surfaceLegacyIds: ReadonlyMap<string, string>,
): string | null {
  const mapped = surfaceLegacyIds.get(surfaceId);
  if (mapped) return mapped;
  const stripped = surfaceId.replace(/^ui:surface:/, "").replace(/^ui:surface:runtime:/, "");
  if (screens.some((screen) => screen.id === stripped)) return stripped;
  return stripped || null;
}

/**
 * Pure projection — no AST/framework inference.
 */
export function projectUiGraphToAppflow(graph: UiInteractionGraph): AppflowProjectionModel {
  const screens = projectUiGraphToLegacyScreens(graph);
  const surfaceLegacyIds = new Map<string, string>();
  for (const surface of graph.surfaces) {
    const legacy =
      typeof surface.attributes?.legacyScreenId === "string"
        ? surface.attributes.legacyScreenId
        : surface.id.replace(/^ui:surface:(?:runtime:)?/, "");
    surfaceLegacyIds.set(surface.id, legacy);
  }

  const surfaceStatusByScreenId: Record<string, UiKnowledgeStatus> = {};
  const surfaceConfidenceByScreenId: Record<string, number> = {};
  for (const surface of graph.surfaces) {
    const legacyId = surfaceLegacyIds.get(surface.id);
    if (!legacyId) continue;
    surfaceStatusByScreenId[legacyId] = surface.status;
    surfaceConfidenceByScreenId[legacyId] = surface.confidence;
  }

  const edges: AppflowProjectionEdge[] = [];
  const seen = new Set<string>();
  for (const transition of graph.transitions) {
    const type = edgeTypeFromTransition(transition.kind);
    if (!type) continue;
    const fromId = legacyIdFromSurfaceId(transition.fromSurfaceId, screens, surfaceLegacyIds);
    const toId = legacyIdFromSurfaceId(transition.toSurfaceId, screens, surfaceLegacyIds);
    if (!fromId || !toId || fromId === toId) continue;
    const key = `${fromId}\t${toId}\t${type}\t${transition.trigger?.label ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const normalized = normalizeUiTrigger(transition.trigger);
    const status: UiKnowledgeStatus =
      type === "navigate"
        ? transition.status
        : normalized.isUnknown && transition.status !== "unknown"
          ? "unknown"
          : transition.status;
    edges.push({
      fromId,
      toId,
      type,
      targetPath: transition.targetPath,
      trigger: {
        label: normalized.isUnknown ? undefined : normalized.trigger.label,
        selector: normalized.trigger.selector,
        testId: normalized.trigger.testId,
        file: normalized.trigger.filePath,
        line: normalized.trigger.line,
        confidence: transition.confidence,
      },
      /** When open/switch/menu has no evidenced control, status stays unknown. */
      status,
      confidence: transition.confidence,
      triggerDisplay: normalized.displayLabel,
      triggerUnknown: normalized.isUnknown,
    });
  }

  return {
    screens,
    edges,
    surfaceStatusByScreenId,
    surfaceConfidenceByScreenId,
  };
}
