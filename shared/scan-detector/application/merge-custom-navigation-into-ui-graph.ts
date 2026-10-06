/**
 * Merge custom-navigation drafts into a UIInteractionGraph (PU-05).
 * Location: shared/scan-detector/application/merge-custom-navigation-into-ui-graph.ts
 */

import type {
  LegacyScreenLike,
  LegacyScreenType,
  UiEvidenceRef,
  UiInteractionGraph,
  UiSurface,
  UiTransition,
} from "../../ui-interaction-graph.types.js";
import type {
  CustomNavigationExtractResult,
  CustomNavSurfaceDraft,
} from "./extract-custom-navigation.js";

function legacyTypeFromKind(kind: CustomNavSurfaceDraft["kind"]): LegacyScreenType {
  if (kind === "page") return "page";
  if (kind === "view") return "view";
  if (kind === "modal") return "modal";
  if (kind === "tab") return "tab";
  if (kind === "menu") return "dropdown";
  return "screen";
}

/**
 * Convert custom-nav drafts to legacy Screen-like rows for AppFlow adapters.
 * Unknown computed paths keep empty path (no invented targets).
 */
export function customNavigationToLegacyScreens(
  result: CustomNavigationExtractResult,
): LegacyScreenLike[] {
  const host = result.surfaces.find((s) => s.attributes?.role === "nav-host");
  const screens: LegacyScreenLike[] = [];
  const navigatesTo: string[] = [];

  for (const surface of result.surfaces) {
    if (surface.attributes?.role === "nav-host") continue;
    const path = surface.path ?? "";
    if (path) navigatesTo.push(path);
    screens.push({
      id: surface.id,
      name: surface.label,
      path,
      filePath: surface.filePath,
      type: legacyTypeFromKind(surface.kind),
      framework: "custom-nav",
      navigatesTo: [],
      knowledgeStatus: surface.status,
      evidenceLine: surface.line,
      confidence: surface.confidence,
    });
  }

  if (host) {
    screens.unshift({
      id: host.id,
      name: host.label,
      path: host.path ?? "/",
      filePath: host.filePath,
      type: "screen",
      framework: "custom-nav",
      navigatesTo: [...new Set(navigatesTo)],
      knowledgeStatus: host.status,
      evidenceLine: host.line,
      confidence: host.confidence,
    });
  }

  return screens;
}

/**
 * Merge custom-nav surfaces/transitions into an existing UIInteractionGraph.
 */
export function mergeCustomNavigationIntoUiGraph(
  graph: UiInteractionGraph,
  result: CustomNavigationExtractResult,
  detectorId = "custom-navigation-v1",
): UiInteractionGraph {
  const surfaces = [...graph.surfaces];
  const transitions = [...graph.transitions];
  const evidence = [...graph.evidence];
  const existingIds = new Set(surfaces.map((s) => s.id));

  for (const draft of result.surfaces) {
    if (existingIds.has(draft.id)) continue;
    existingIds.add(draft.id);
    const evidenceId = `ui:ev:custom-nav:${draft.id}`;
    evidence.push({
      id: evidenceId,
      kind: `custom-nav:${draft.source}`,
      status: draft.status,
      origin: "static",
      confidence: draft.confidence,
      summary: `Custom navigation ${draft.source}: ${draft.label}`,
      filePath: draft.filePath,
      line: draft.line,
      attributes: {
        detectorId,
        source: draft.source,
        ...(draft.attributes ?? {}),
      },
    } satisfies UiEvidenceRef);

    surfaces.push({
      id: draft.id,
      kind: draft.kind,
      label: draft.label,
      path: draft.path,
      filePath: draft.filePath,
      framework: "custom-nav",
      status: draft.status,
      confidence: draft.confidence,
      evidenceIds: [evidenceId],
      attributes: {
        detectorId,
        source: draft.source,
        evidenceLine: draft.line,
        ...(draft.attributes ?? {}),
      },
    } satisfies UiSurface);
  }

  for (const tr of result.transitions) {
    if (transitions.some((t) => t.id === tr.id)) continue;
    const evidenceId = `ui:ev:custom-nav-tr:${tr.id}`;
    evidence.push({
      id: evidenceId,
      kind: `custom-nav-transition:${tr.source}`,
      status: tr.status,
      origin: "static",
      confidence: tr.confidence,
      summary: `Custom nav transition → ${tr.targetPath ?? "unknown"}`,
      filePath: tr.filePath,
      line: tr.line,
      attributes: { detectorId, source: tr.source },
    });
    transitions.push({
      id: tr.id,
      kind: "navigate",
      fromSurfaceId: tr.fromSurfaceId,
      toSurfaceId: tr.toSurfaceId,
      targetPath: tr.targetPath,
      status: tr.status,
      confidence: tr.confidence,
      evidenceIds: [evidenceId],
      attributes: {
        detectorId,
        source: tr.source,
        evidenceLine: tr.line,
      },
    } satisfies UiTransition);
  }

  const routeSurfaceCount = surfaces.filter((s) =>
    s.kind === "page" || s.kind === "screen" || s.kind === "view" || s.kind === "window"
  ).length;

  return {
    ...graph,
    surfaces,
    transitions,
    evidence,
    stats: {
      ...graph.stats,
      surfaceCount: surfaces.length,
      transitionCount: transitions.length,
      routeSurfaceCount,
      stateSurfaceCount: surfaces.length - routeSurfaceCount,
    },
  };
}
