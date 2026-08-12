/**
 * Blueprint shell view ids, German labels, and URL helpers.
 * Location: src/modules/blueprint/
 * Canonical URL: /blueprint/<viewId> (legacy ?view= still parsed).
 */

export type BlueprintShellViewId =
  | "atlas"
  | "architecture"
  | "dependencies"
  | "execution"
  | "infrastructure"
  | "diagnostics"
  | "evolution";

export interface BlueprintViewDefinition {
  id: BlueprintShellViewId;
  label: string;
}

/** Figma sidebar order with German labels. */
export const BLUEPRINT_VIEWS: readonly BlueprintViewDefinition[] = [
  { id: "atlas", label: "Atlas" },
  { id: "architecture", label: "Architektur" },
  { id: "dependencies", label: "Abhängigkeiten" },
  { id: "execution", label: "Ausführung" },
  { id: "infrastructure", label: "Infrastruktur" },
  { id: "diagnostics", label: "Diagnosen" },
  { id: "evolution", label: "Evolution" },
] as const;

const VIEW_IDS = new Set(BLUEPRINT_VIEWS.map((view) => view.id));

export function getDefaultBlueprintView(): BlueprintShellViewId {
  return "diagnostics";
}

export function isBlueprintShellViewId(
  value: string | null | undefined,
): value is BlueprintShellViewId {
  return typeof value === "string" && VIEW_IDS.has(value as BlueprintShellViewId);
}

export function parseBlueprintViewParam(value: string | null | undefined): BlueprintShellViewId {
  if (isBlueprintShellViewId(value)) return value;
  return getDefaultBlueprintView();
}

export function blueprintViewPath(viewId: BlueprintShellViewId): string {
  return `/blueprint/${viewId}`;
}

/** First path segment after /blueprint/, or null if absent. */
export function blueprintViewIdFromPathname(pathname: string): string | null {
  const parts = pathname.replace(/\/$/, "").split("/").filter(Boolean);
  if (parts[0] !== "blueprint") return null;
  return parts[1] ?? null;
}

export function parseBlueprintViewFromLocation(
  pathname: string,
  search: string,
): BlueprintShellViewId {
  const fromPath = blueprintViewIdFromPathname(pathname);
  if (fromPath) return parseBlueprintViewParam(fromPath);
  const fromQuery = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search).get(
    "view",
  );
  return parseBlueprintViewParam(fromQuery);
}

export function getBlueprintViewLabel(viewId: BlueprintShellViewId): string {
  return BLUEPRINT_VIEWS.find((view) => view.id === viewId)?.label ?? viewId;
}

/** @deprecated Use blueprintViewPath. Kept for query-string redirects. */
export function blueprintViewSearchParam(viewId: BlueprintShellViewId): string {
  return `view=${viewId}`;
}
