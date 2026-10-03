/**
 * Fuse runtime observer crawl into UIInteractionGraph (SDE-10).
 * Verify matches, mark conflicts, append runtime-only surfaces.
 * Location: shared/scan-detector/application/fuse-runtime-into-ui-graph.ts
 */

import type { RuntimeObserverCrawlResult } from "../domain/runtime/crawl-result.js";
import type {
  UiEvidenceRef,
  UiInteractionGraph,
  UiSurface,
  UiSurfaceKind,
  UiTransition,
} from "../../ui-interaction-graph.types.js";

export interface FuseRuntimeIntoUiGraphInput {
  graph: UiInteractionGraph;
  crawl: RuntimeObserverCrawlResult;
  detectorId?: string;
}

function cloneGraph(graph: UiInteractionGraph): UiInteractionGraph {
  return {
    ...graph,
    surfaces: graph.surfaces.map((surface) => ({
      ...surface,
      evidenceIds: [...surface.evidenceIds],
      attributes: surface.attributes ? { ...surface.attributes } : undefined,
    })),
    transitions: graph.transitions.map((transition) => ({
      ...transition,
      evidenceIds: [...transition.evidenceIds],
      attributes: transition.attributes ? { ...transition.attributes } : undefined,
    })),
    evidence: [...graph.evidence],
    stats: { ...graph.stats },
  };
}

function findSurfaceByLegacyId(graph: UiInteractionGraph, legacyId: string): UiSurface | undefined {
  return graph.surfaces.find(
    (surface) =>
      surface.attributes?.legacyScreenId === legacyId ||
      surface.id === `ui:surface:${legacyId}` ||
      surface.id === legacyId,
  );
}

function surfaceKindFromRuntime(type: "modal" | "tab" | "dropdown"): UiSurfaceKind {
  if (type === "tab") return "tab";
  if (type === "dropdown") return "menu";
  return "modal";
}

function isRouteSurface(kind: UiSurfaceKind): boolean {
  return kind === "page" || kind === "screen" || kind === "view" || kind === "window";
}

function recomputeStats(graph: UiInteractionGraph): void {
  const routeSurfaceCount = graph.surfaces.filter((surface) => isRouteSurface(surface.kind)).length;
  graph.stats = {
    surfaceCount: graph.surfaces.length,
    transitionCount: graph.transitions.length,
    routeSurfaceCount,
    stateSurfaceCount: graph.surfaces.length - routeSurfaceCount,
    conflictCount:
      graph.surfaces.filter((surface) => surface.status === "conflicted").length +
      graph.transitions.filter((transition) => transition.status === "conflicted").length,
    runtimeOnlyCount: graph.surfaces.filter((surface) => surface.attributes?.runtimeOnly === true)
      .length,
  };
}

/**
 * Merge runtime observations into a UI graph without silently overwriting static claims.
 */
export function fuseRuntimeIntoUiGraph(input: FuseRuntimeIntoUiGraphInput): UiInteractionGraph {
  const detectorId = input.detectorId ?? "runtime-playwright-observer-v1";
  const next = cloneGraph(input.graph);
  const crawl = input.crawl;
  const at = crawl.crawledAt || new Date().toISOString();

  for (const snapshot of crawl.snapshots) {
    const surface = findSurfaceByLegacyId(next, snapshot.screenId);
    const evidenceId = `ui:ev:runtime:snapshot:${snapshot.screenId}`;
    const evidence: UiEvidenceRef = {
      id: evidenceId,
      kind: "runtime-snapshot",
      status: "observed",
      origin: "runtime",
      confidence: 0.85,
      summary: `Runtime snapshot ${snapshot.route}`,
      attributes: {
        route: snapshot.route,
        interactiveCount: snapshot.interactiveCount,
        detectorId,
      },
    };
    next.evidence.push(evidence);

    if (surface) {
      surface.status = surface.status === "conflicted" ? "conflicted" : "verified";
      surface.confidence = Math.max(surface.confidence, 0.85);
      surface.evidenceIds = [...surface.evidenceIds, evidenceId];
      if (snapshot.route && !surface.path) surface.path = snapshot.route;
      continue;
    }

    // Runtime-only surface (no static match required)
    next.surfaces.push({
      id: `ui:surface:runtime:${snapshot.screenId}`,
      kind: "screen",
      label: snapshot.title || snapshot.route || snapshot.screenId,
      path: snapshot.route,
      status: "observed",
      confidence: 0.8,
      evidenceIds: [evidenceId],
      attributes: {
        legacyScreenId: snapshot.screenId,
        runtimeOnly: true,
      },
    });
  }

  for (const capture of crawl.stateScreens) {
    if (!capture.screenId) continue;
    const existing = findSurfaceByLegacyId(next, capture.screenId);
    const evidenceId = `ui:ev:runtime:state:${capture.screenId}`;
    next.evidence.push({
      id: evidenceId,
      kind: "runtime-state-capture",
      status: "observed",
      origin: "runtime",
      confidence: 0.85,
      summary: `Runtime state ${capture.type}`,
      attributes: {
        type: capture.type,
        label: capture.label ?? null,
        parentScreenId: capture.parentScreenId,
        // Screenshot presence only — never persist tokenized URLs as secrets.
        hasScreenshot: Boolean(capture.screenshotUrl),
      },
    });

    if (existing) {
      existing.status = existing.status === "conflicted" ? "conflicted" : "verified";
      existing.evidenceIds = [...existing.evidenceIds, evidenceId];
      continue;
    }

    const parent = findSurfaceByLegacyId(next, capture.parentScreenId);
    next.surfaces.push({
      id: `ui:surface:runtime:${capture.screenId}`,
      kind: surfaceKindFromRuntime(capture.type),
      label: capture.label || capture.screenId,
      path: parent?.path,
      parentSurfaceId: parent?.id,
      stateKey: `${capture.type}:${capture.label ?? capture.screenId}`,
      status: "observed",
      confidence: 0.8,
      evidenceIds: [evidenceId],
      attributes: {
        legacyScreenId: capture.screenId,
        runtimeOnly: true,
      },
    });
  }

  for (const edge of crawl.verifiedEdges) {
    const from = findSurfaceByLegacyId(next, edge.fromScreenId);
    if (!from) continue;
    let to = edge.toScreenId ? findSurfaceByLegacyId(next, edge.toScreenId) : undefined;
    if (!to && edge.toScreenId) {
      to = {
        id: `ui:surface:runtime:${edge.toScreenId}`,
        kind:
          edge.type === "navigate"
            ? "screen"
            : surfaceKindFromRuntime(
                edge.type === "switch-tab"
                  ? "tab"
                  : edge.type === "dropdown-action"
                    ? "dropdown"
                    : "modal",
              ),
        label: edge.targetPath || edge.toScreenId,
        path: edge.targetPath ?? edge.targetRoute,
        parentSurfaceId: edge.type === "navigate" ? undefined : from.id,
        status: "observed",
        confidence: 0.8,
        evidenceIds: [],
        attributes: {
          legacyScreenId: edge.toScreenId,
          runtimeOnly: true,
        },
      };
      next.surfaces.push(to);
    }
    if (!to) continue;

    const evidenceId = `ui:ev:runtime:edge:${edge.fromScreenId}:${edge.toScreenId ?? edge.targetPath}`;
    next.evidence.push({
      id: evidenceId,
      kind: edge.verification === "route-change" ? "runtime-navigation" : "runtime-state-change",
      status: "observed",
      origin: "runtime",
      confidence: 0.9,
      summary: `Runtime verified ${edge.type}`,
      attributes: {
        sourceRoute: edge.sourceRoute,
        targetRoute: edge.targetRoute ?? null,
        triggerLabel: edge.trigger?.label ?? null,
      },
    });

    const existingTransition = next.transitions.find(
      (transition) =>
        transition.fromSurfaceId === from.id &&
        transition.toSurfaceId === to!.id &&
        (transition.kind === "navigate" ||
          transition.kind === "open-surface" ||
          transition.kind === "switch-tab" ||
          transition.kind === "menu-action"),
    );

    if (existingTransition) {
      existingTransition.status =
        existingTransition.status === "conflicted" ? "conflicted" : "verified";
      existingTransition.confidence = Math.max(existingTransition.confidence, 0.9);
      existingTransition.evidenceIds = [...existingTransition.evidenceIds, evidenceId];
    } else {
      const kind =
        edge.type === "navigate"
          ? "navigate"
          : edge.type === "switch-tab"
            ? "switch-tab"
            : edge.type === "dropdown-action"
              ? "menu-action"
              : "open-surface";
      const transition: UiTransition = {
        id: `ui:tr:runtime:${edge.fromScreenId}:${edge.toScreenId ?? "unknown"}:${edge.type}`,
        kind,
        fromSurfaceId: from.id,
        toSurfaceId: to.id,
        trigger: edge.trigger
          ? {
              label: edge.trigger.label,
              selector: edge.trigger.selector,
              testId: edge.trigger.testId,
              role: edge.trigger.role,
              href: edge.trigger.href,
            }
          : undefined,
        targetPath: edge.targetPath,
        status: "observed",
        confidence: 0.9,
        evidenceIds: [evidenceId],
        attributes: { runtimeOnly: !edge.toScreenId ? true : false },
      };
      next.transitions.push(transition);
    }
  }

  for (const issue of crawl.issues) {
    if (issue.code !== "graph_without_runtime_match" && issue.code !== "dom_without_graph_match") {
      continue;
    }
    const subject = issue.screenId ? findSurfaceByLegacyId(next, issue.screenId) : undefined;
    const evidenceId = `ui:ev:runtime:conflict:${issue.code}:${issue.screenId ?? "graph"}`;
    next.evidence.push({
      id: evidenceId,
      kind: "runtime-static-mismatch",
      status: "conflicted",
      origin: "runtime",
      confidence: 0.7,
      summary: issue.message,
      attributes: {
        code: issue.code,
        severity: issue.severity,
        producedAt: at,
      },
    });
    if (subject) {
      subject.status = "conflicted";
      subject.evidenceIds = [...subject.evidenceIds, evidenceId];
    }
  }

  recomputeStats(next);
  return next;
}
