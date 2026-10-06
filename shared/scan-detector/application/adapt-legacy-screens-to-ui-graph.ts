/**
 * Adapt legacy AppFlow Screen[] heuristics into UIInteractionGraph (SDE-10).
 * Output evidence is heuristic/static — not authoritative Screen[].
 * Location: shared/scan-detector/application/adapt-legacy-screens-to-ui-graph.ts
 */

import type {
  LegacyScreenLike,
  LegacyScreenType,
  UiEvidenceRef,
  UiInteractionGraph,
  UiSurface,
  UiSurfaceKind,
  UiTransition,
  UiTransitionKind,
} from "../../ui-interaction-graph.types.js";

export interface AdaptLegacyScreensInput {
  projectId: string;
  screens: readonly LegacyScreenLike[];
  analyzedAt?: string;
  detectorId?: string;
}

function surfaceKindFromScreenType(type: LegacyScreenType | undefined): UiSurfaceKind {
  switch (type) {
    case "page":
      return "page";
    case "screen":
      return "screen";
    case "view":
      return "view";
    case "modal":
      return "modal";
    case "tab":
      return "tab";
    case "dropdown":
      return "menu";
    default:
      return "unknown";
  }
}

function isRouteSurface(kind: UiSurfaceKind): boolean {
  return kind === "page" || kind === "screen" || kind === "view" || kind === "window";
}

function transitionKindFromEdge(
  edgeType: "open-modal" | "switch-tab" | "dropdown-action",
): UiTransitionKind {
  if (edgeType === "switch-tab") return "switch-tab";
  if (edgeType === "dropdown-action") return "menu-action";
  return "open-surface";
}

function surfaceId(screenId: string): string {
  return screenId.startsWith("ui:") ? screenId : `ui:surface:${screenId}`;
}

/**
 * Convert legacy Screen[] into a UIInteractionGraph.
 * Heuristic origins stay on evidence; graph is the canonical model.
 */
export function adaptLegacyScreensToUiGraph(input: AdaptLegacyScreensInput): UiInteractionGraph {
  const detectorId = input.detectorId ?? "web-ui-legacy-adapter-v1";
  const analyzedAt = input.analyzedAt ?? new Date().toISOString();
  const screens = Array.isArray(input.screens) ? input.screens : [];
  const surfaces: UiSurface[] = [];
  const transitions: UiTransition[] = [];
  const evidence: UiEvidenceRef[] = [];
  const screenIdToSurfaceId = new Map<string, string>();

  for (const screen of screens) {
    const id = surfaceId(screen.id);
    screenIdToSurfaceId.set(screen.id, id);
    const kind = surfaceKindFromScreenType(screen.type);
    const evidenceId = `ui:ev:static:${screen.id}`;
    const status = screen.knowledgeStatus ?? "inferred";
    const confidence =
      typeof screen.confidence === "number"
        ? screen.confidence
        : kind === "unknown" || status === "unknown"
          ? 0.5
          : screen.type === "page"
            ? 0.85
            : 0.7;
    const origin = screen.framework === "custom-nav" ? "static" : "heuristic";

    evidence.push({
      id: evidenceId,
      kind: screen.framework === "custom-nav" ? "custom-nav-legacy" : "legacy-screen-heuristic",
      status,
      origin,
      confidence,
      summary: `Legacy Screen adapter: ${screen.name}`,
      filePath: screen.filePath,
      line: screen.evidenceLine,
      attributes: {
        legacyScreenId: screen.id,
        legacyType: screen.type ?? null,
        path: screen.path || null,
        stateKey: screen.stateKey ?? null,
        detectorId,
      },
    });

    surfaces.push({
      id,
      kind: status === "unknown" && !screen.path ? "unknown" : kind,
      label: screen.name,
      path: screen.path || undefined,
      stateKey: screen.stateKey,
      parentSurfaceId: screen.parentScreenId
        ? (screenIdToSurfaceId.get(screen.parentScreenId) ?? surfaceId(screen.parentScreenId))
        : undefined,
      filePath: screen.filePath,
      framework: screen.framework,
      status,
      confidence,
      evidenceIds: [evidenceId],
      attributes: {
        legacyScreenId: screen.id,
        runtimeOnly: false,
        evidenceLine: screen.evidenceLine ?? null,
      },
    });
  }

  // Second pass: fix parent ids once all surfaces registered
  for (const screen of screens) {
    if (!screen.parentScreenId) continue;
    const surface = surfaces.find((item) => item.attributes?.legacyScreenId === screen.id);
    const parentId = screenIdToSurfaceId.get(screen.parentScreenId);
    if (surface && parentId) surface.parentSurfaceId = parentId;
  }

  for (const screen of screens) {
    const fromId = screenIdToSurfaceId.get(screen.id);
    if (!fromId) continue;

    for (const target of screen.stateTargets ?? []) {
      const toId =
        screenIdToSurfaceId.get(target.targetScreenId) ?? surfaceId(target.targetScreenId);
      const evidenceId = `ui:ev:transition:${screen.id}:${target.targetScreenId}:${target.edgeType}`;
      evidence.push({
        id: evidenceId,
        kind: "legacy-state-target",
        status: "inferred",
        origin: "heuristic",
        confidence: target.trigger?.confidence ?? 0.65,
        summary: `State target ${target.edgeType}`,
        filePath: target.trigger?.file ?? screen.filePath,
        line: target.trigger?.line,
        attributes: {
          edgeType: target.edgeType,
          triggerLabel: target.trigger?.label ?? null,
        },
      });
      transitions.push({
        id: `ui:tr:${screen.id}:${target.targetScreenId}:${target.edgeType}`,
        kind: transitionKindFromEdge(target.edgeType),
        fromSurfaceId: fromId,
        toSurfaceId: toId,
        trigger: target.trigger
          ? {
              label: target.trigger.label,
              selector: target.trigger.selector,
              testId: target.trigger.testId,
              filePath: target.trigger.file,
              line: target.trigger.line,
            }
          : undefined,
        status: "inferred",
        confidence: target.trigger?.confidence ?? 0.65,
        evidenceIds: [evidenceId],
      });
    }

    for (const nav of screen.navigatesTo ?? []) {
      const toId = screenIdToSurfaceId.get(nav) ?? surfaceId(nav);
      const evidenceId = `ui:ev:nav:${screen.id}:${nav}`;
      evidence.push({
        id: evidenceId,
        kind: "legacy-navigation",
        status: "inferred",
        origin: "heuristic",
        confidence: 0.6,
        summary: `Navigate ${screen.id} → ${nav}`,
        filePath: screen.filePath,
      });
      transitions.push({
        id: `ui:tr:nav:${screen.id}:${nav}`,
        kind: "navigate",
        fromSurfaceId: fromId,
        toSurfaceId: toId,
        status: "inferred",
        confidence: 0.6,
        evidenceIds: [evidenceId],
      });
    }
  }

  const routeSurfaceCount = surfaces.filter((surface) => isRouteSurface(surface.kind)).length;
  return {
    version: 1,
    projectId: input.projectId,
    analyzedAt,
    surfaces,
    transitions,
    evidence,
    stats: {
      surfaceCount: surfaces.length,
      transitionCount: transitions.length,
      routeSurfaceCount,
      stateSurfaceCount: surfaces.length - routeSurfaceCount,
      conflictCount: 0,
      runtimeOnlyCount: 0,
    },
  };
}
