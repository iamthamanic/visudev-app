/**
 * Generic custom-navigation detection for AppFlow / UIInteractionGraph (PU-05).
 * Captures typed route tables, path-builder call sites, and switch/union view dispatch
 * without framework- or project-specific hardcoding.
 * Location: shared/scan-detector/application/extract-custom-navigation.ts
 */

import type { UiKnowledgeStatus, UiSurfaceKind } from "../../ui-interaction-graph.types.js";

export interface CustomNavFileInput {
  path: string;
  content: string;
}

export type CustomNavSource =
  | "route-table"
  | "path-builder"
  | "switch-dispatch"
  | "union-type"
  | "unknown-computed";

export interface CustomNavSurfaceDraft {
  id: string;
  label: string;
  /** Absent when path is not statically resolvable. */
  path?: string;
  kind: UiSurfaceKind;
  filePath: string;
  line: number;
  status: UiKnowledgeStatus;
  confidence: number;
  source: CustomNavSource;
  attributes?: Record<string, string | number | boolean | null>;
}

export interface CustomNavTransitionDraft {
  id: string;
  fromSurfaceId: string;
  toSurfaceId: string;
  targetPath?: string;
  filePath: string;
  line: number;
  status: UiKnowledgeStatus;
  confidence: number;
  source: CustomNavSource;
}

export interface CustomNavigationCoverage {
  routeTablesFound: number;
  pathBuildersResolved: number;
  pathBuildersUnknown: number;
  switchDispatchesFound: number;
  unionMembersFound: number;
  /** COMPLETE when no unknown computed paths; otherwise PARTIAL. */
  status: "COMPLETE" | "PARTIAL";
}

export interface CustomNavigationExtractResult {
  surfaces: CustomNavSurfaceDraft[];
  transitions: CustomNavTransitionDraft[];
  coverage: CustomNavigationCoverage;
}

const ROUTE_TABLE_NAME =
  /\b(?:const|let|var|export\s+const)\s+([A-Za-z_][\w]*(?:[Rr]outes?|[Pp]aths?|[Nn]av(?:igation)?Items?|[Mm]enuItems?|[Mm]anifest)\w*)\s*(?::[^=]+)?=\s*\{/g;

const PATH_BUILDER_CALL =
  /\b([A-Za-z_][\w]*(?:[Pp]ath|[Rr]oute|[Uu]rl|[Hh]ref|[Nn]av)\w*)\s*\(\s*(["'`])([^"'`]+)\2\s*[,)]/g;

const PATH_BUILDER_DYNAMIC =
  /\b([A-Za-z_][\w]*(?:[Pp]ath|[Rr]oute|[Uu]rl|[Hh]ref|[Nn]av)\w*)\s*\(\s*([A-Za-z_][\w.]*)\s*[,)]/g;

const TEMPLATE_PATH = /`(\/[^`$]*\$\{[^`]+\}[^`]*)`/g;

const SWITCH_CASE_RETURN =
  /case\s+["']([^"']{1,80})["']\s*:[\s\S]{0,400}?return\s+<\s*([A-Za-z_][\w]*)/g;

const STRING_UNION =
  /\b(?:type|export\s+type)\s+([A-Za-z_][\w]*(?:[Vv]iew|[Pp]ane|[Ss]creen|[Pp]age|[Rr]oute|[Tt]ab)\w*)\s*=\s*((?:["'][^"']+["']\s*\|\s*)+["'][^"']+["'])/g;

const OBJECT_PATH_ENTRY =
  /(?:^|[,{\n])\s*(?:["']([A-Za-z_][\w-]*)["']|([A-Za-z_][\w]*))\s*:\s*["'](\/[^"']{1,120})["']/gm;

function lineAt(content: string, index: number): number {
  if (index <= 0) return 1;
  let line = 1;
  for (let i = 0; i < index && i < content.length; i += 1) {
    if (content.charCodeAt(i) === 10) line += 1;
  }
  return line;
}

function normalizePath(raw: string): string | undefined {
  const s = raw.trim();
  if (!s) return undefined;
  if (s.startsWith("//") || s.toLowerCase().startsWith("javascript:")) return undefined;
  if (s.includes("://")) return undefined;
  if (s.includes("${")) return undefined;
  if (s.startsWith("/")) return s.replace(/\/+/g, "/").replace(/\/$/, "") || "/";
  return `/${s}`;
}

function findMatchingBrace(content: string, openIndex: number): number {
  let depth = 0;
  for (let i = openIndex; i < content.length; i += 1) {
    const ch = content[i];
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function surfaceId(filePath: string, key: string, source: CustomNavSource): string {
  return `ui:custom-nav:${source}:${filePath}:${key}`;
}

/**
 * Extract custom navigation surfaces/transitions from source files.
 * Does not execute code; only literal evidence is resolved to paths.
 */
export function extractCustomNavigation(
  files: readonly CustomNavFileInput[],
): CustomNavigationExtractResult {
  const surfaces: CustomNavSurfaceDraft[] = [];
  const transitions: CustomNavTransitionDraft[] = [];
  const seenSurface = new Set<string>();
  const pathByKey = new Map<string, string>();

  let routeTablesFound = 0;
  let pathBuildersResolved = 0;
  let pathBuildersUnknown = 0;
  let switchDispatchesFound = 0;
  let unionMembersFound = 0;

  const addSurface = (draft: CustomNavSurfaceDraft): void => {
    if (seenSurface.has(draft.id)) return;
    seenSurface.add(draft.id);
    surfaces.push(draft);
    if (draft.path) {
      const key = draft.label.toLowerCase();
      if (!pathByKey.has(key)) pathByKey.set(key, draft.path);
    }
  };

  for (const file of files) {
    const { content, path: filePath } = file;
    if (!content || content.length < 8) continue;

    ROUTE_TABLE_NAME.lastIndex = 0;
    let tableMatch: RegExpExecArray | null;
    while ((tableMatch = ROUTE_TABLE_NAME.exec(content)) !== null) {
      const tableName = tableMatch[1];
      const openBrace = content.indexOf("{", tableMatch.index + tableMatch[0].length - 1);
      if (openBrace < 0) continue;
      const closeBrace = findMatchingBrace(content, openBrace);
      if (closeBrace < 0) continue;
      const body = content.slice(openBrace, closeBrace + 1);
      routeTablesFound += 1;
      OBJECT_PATH_ENTRY.lastIndex = 0;
      let entry: RegExpExecArray | null;
      while ((entry = OBJECT_PATH_ENTRY.exec(body)) !== null) {
        const key = entry[1] ?? entry[2] ?? "";
        const path = normalizePath(entry[3] ?? "");
        if (!key || !path) continue;
        const absIndex = openBrace + entry.index;
        const id = surfaceId(filePath, key, "route-table");
        addSurface({
          id,
          label: key,
          path,
          kind: "page",
          filePath,
          line: lineAt(content, absIndex),
          status: "detected",
          confidence: 0.9,
          source: "route-table",
          attributes: {
            tableName,
            routeKey: key,
            detector: "custom-navigation-v1",
          },
        });
        pathByKey.set(key.toLowerCase(), path);
      }
    }

    const loosePath = /\bpath\s*:\s*["'](\/[^"']{1,120})["']/g;
    let loose: RegExpExecArray | null;
    while ((loose = loosePath.exec(content)) !== null) {
      const path = normalizePath(loose[1] ?? "");
      if (!path) continue;
      const segment = path.split("/").filter(Boolean).pop() ?? path;
      const id = surfaceId(filePath, path, "route-table");
      addSurface({
        id,
        label: segment,
        path,
        kind: "page",
        filePath,
        line: lineAt(content, loose.index),
        status: "detected",
        confidence: 0.85,
        source: "route-table",
        attributes: {
          routeKey: segment,
          detector: "custom-navigation-v1",
        },
      });
    }

    PATH_BUILDER_CALL.lastIndex = 0;
    let builder: RegExpExecArray | null;
    while ((builder = PATH_BUILDER_CALL.exec(content)) !== null) {
      const fn = builder[1] ?? "";
      const arg = builder[3] ?? "";
      if (/^(setTimeout|setInterval|require|import)$/i.test(fn)) continue;
      const resolvedFromTable = pathByKey.get(arg.toLowerCase());
      const path = resolvedFromTable ?? normalizePath(arg.startsWith("/") ? arg : `/${arg}`);
      if (!path) {
        pathBuildersUnknown += 1;
        const id = surfaceId(filePath, `unknown:${builder.index}`, "unknown-computed");
        addSurface({
          id,
          label: `${fn}(…)`,
          kind: "unknown",
          filePath,
          line: lineAt(content, builder.index),
          status: "unknown",
          confidence: 0.25,
          source: "unknown-computed",
          attributes: {
            builder: fn,
            reason: "unnormalizable-literal",
            detector: "custom-navigation-v1",
            coverage: "PARTIAL",
          },
        });
        continue;
      }
      pathBuildersResolved += 1;
      const id = surfaceId(filePath, path, "path-builder");
      addSurface({
        id,
        label: arg.replace(/^\//, "") || path,
        path,
        kind: "page",
        filePath,
        line: lineAt(content, builder.index),
        status: "detected",
        confidence: resolvedFromTable ? 0.88 : 0.75,
        source: "path-builder",
        attributes: {
          builder: fn,
          arg,
          detector: "custom-navigation-v1",
        },
      });
    }

    PATH_BUILDER_DYNAMIC.lastIndex = 0;
    let dyn: RegExpExecArray | null;
    while ((dyn = PATH_BUILDER_DYNAMIC.exec(content)) !== null) {
      const fn = dyn[1] ?? "";
      const argName = dyn[2] ?? "";
      if (/^(setTimeout|setInterval|require|import)$/i.test(fn)) continue;
      const afterParen = content.slice(dyn.index, dyn.index + fn.length + 8);
      if (/["'`]/.test(afterParen.slice(fn.length))) continue;
      pathBuildersUnknown += 1;
      const id = surfaceId(filePath, `dyn:${fn}:${argName}:${dyn.index}`, "unknown-computed");
      addSurface({
        id,
        label: `${fn}(${argName})`,
        kind: "unknown",
        filePath,
        line: lineAt(content, dyn.index),
        status: "unknown",
        confidence: 0.2,
        source: "unknown-computed",
        attributes: {
          builder: fn,
          argName,
          reason: "computed-path",
          detector: "custom-navigation-v1",
          coverage: "PARTIAL",
        },
      });
    }

    TEMPLATE_PATH.lastIndex = 0;
    let tpl: RegExpExecArray | null;
    while ((tpl = TEMPLATE_PATH.exec(content)) !== null) {
      pathBuildersUnknown += 1;
      const id = surfaceId(filePath, `tpl:${tpl.index}`, "unknown-computed");
      addSurface({
        id,
        label: "computed template path",
        kind: "unknown",
        filePath,
        line: lineAt(content, tpl.index),
        status: "unknown",
        confidence: 0.2,
        source: "unknown-computed",
        attributes: {
          reason: "template-interpolation",
          detector: "custom-navigation-v1",
          coverage: "PARTIAL",
        },
      });
    }

    SWITCH_CASE_RETURN.lastIndex = 0;
    let sw: RegExpExecArray | null;
    while ((sw = SWITCH_CASE_RETURN.exec(content)) !== null) {
      const viewId = sw[1] ?? "";
      const component = sw[2] ?? "";
      if (!viewId) continue;
      switchDispatchesFound += 1;
      const mapped = pathByKey.get(viewId.toLowerCase());
      const path = mapped ?? `/view/${viewId}`;
      const id = surfaceId(filePath, viewId, "switch-dispatch");
      addSurface({
        id,
        label: component.replace(/(Screen|Page|View|Pane|Dock)$/i, "") || viewId,
        path,
        kind: "view",
        filePath,
        line: lineAt(content, sw.index),
        status: mapped ? "detected" : "inferred",
        confidence: mapped ? 0.85 : 0.7,
        source: "switch-dispatch",
        attributes: {
          viewId,
          component,
          detector: "custom-navigation-v1",
        },
      });
    }

    STRING_UNION.lastIndex = 0;
    let uni: RegExpExecArray | null;
    while ((uni = STRING_UNION.exec(content)) !== null) {
      const typeName = uni[1] ?? "";
      const unionBody = uni[2] ?? "";
      const members = [...unionBody.matchAll(/["']([^"']+)["']/g)].map((m) => m[1]);
      for (const member of members) {
        if (!member) continue;
        unionMembersFound += 1;
        const mapped = pathByKey.get(member.toLowerCase());
        const path = mapped ?? `/view/${member}`;
        const id = surfaceId(filePath, `${typeName}:${member}`, "union-type");
        addSurface({
          id,
          label: member,
          path,
          kind: "view",
          filePath,
          line: lineAt(content, uni.index),
          status: mapped ? "detected" : "inferred",
          confidence: mapped ? 0.8 : 0.65,
          source: "union-type",
          attributes: {
            typeName,
            member,
            detector: "custom-navigation-v1",
          },
        });
      }
    }
  }

  const hostId = "ui:custom-nav:host";
  const resolved = surfaces.filter((s) => s.path && s.status !== "unknown");
  if (resolved.length > 0) {
    addSurface({
      id: hostId,
      label: "Custom navigation host",
      path: "/",
      kind: "screen",
      filePath: resolved[0]?.filePath ?? "unknown",
      line: 1,
      status: "inferred",
      confidence: 0.5,
      source: "route-table",
      attributes: { detector: "custom-navigation-v1", role: "nav-host" },
    });
    for (const surface of resolved) {
      if (surface.id === hostId) continue;
      transitions.push({
        id: `ui:custom-nav:tr:${hostId}:${surface.id}`,
        fromSurfaceId: hostId,
        toSurfaceId: surface.id,
        targetPath: surface.path,
        filePath: surface.filePath,
        line: surface.line,
        status: surface.status,
        confidence: Math.min(surface.confidence, 0.8),
        source: surface.source,
      });
    }
  }

  const coverage: CustomNavigationCoverage = {
    routeTablesFound,
    pathBuildersResolved,
    pathBuildersUnknown,
    switchDispatchesFound,
    unionMembersFound,
    status: pathBuildersUnknown > 0 ? "PARTIAL" : "COMPLETE",
  };

  return { surfaces, transitions, coverage };
}
