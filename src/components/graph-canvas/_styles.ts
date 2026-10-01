/**
 * Reads graph color tokens from globals.css so Cytoscape matches DaisyUI theme
 * without hardcoding hex values in TS.
 */

import type cytoscape from "cytoscape";

const kindVariables: Record<string, string> = {
  runtime: "--color-graph-runtime",
  service: "--color-graph-service",
  database: "--color-graph-database",
  external: "--color-graph-external",
  file: "--color-graph-file",
  route: "--color-graph-route",
  domain: "--color-graph-domain",
  module: "--color-graph-module",
  symbol: "--color-graph-symbol",
};

const dependencyEdgeVariables: Record<string, string> = {
  imports: "--color-bp-rel-imports",
  calls: "--color-bp-rel-calls",
  api: "--color-bp-rel-api",
  event: "--color-bp-rel-event",
  data: "--color-bp-rel-data",
  auth: "--color-bp-rel-auth",
  validation: "--color-bp-rel-validation",
  external: "--color-bp-rel-external",
};

export function getCssVariable(name: string): string {
  if (typeof window === "undefined") return "";
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** Resolve `var(--token)` or raw CSS colors to concrete values Cytoscape accepts. */
export function resolveCytoscapeColor(value: unknown): string | undefined {
  if (typeof value !== "string" || value.trim().length === 0) return undefined;
  const trimmed = value.trim();
  const varMatch = /^var\((--[a-zA-Z0-9-_]+)\)$/.exec(trimmed);
  if (varMatch) {
    const resolved = getCssVariable(varMatch[1]!);
    return resolved || undefined;
  }
  return trimmed;
}

export function buildStylesheet(): cytoscape.StylesheetStyle[] {
  const nodeDefault = getCssVariable("--color-muted-foreground");
  const edgeColor = getCssVariable("--color-graph-edge");
  const labelColor = getCssVariable("--color-graph-label");
  const labelBg = getCssVariable("--color-background");
  const foreground = getCssVariable("--color-foreground");

  const edgeStyles: cytoscape.StylesheetStyle[] = [
    {
      selector: "edge",
      style: {
        width: 2,
        "line-color": edgeColor,
        "target-arrow-color": edgeColor,
        "target-arrow-shape": "triangle",
        "curve-style": "bezier",
        "line-style": "dashed",
        "line-dash-pattern": [6, 4],
        label: "data(label)",
        color: labelColor,
        "font-size": "10px",
        "text-background-color": labelBg,
        "text-background-opacity": 0.8,
        "text-background-padding": "2px",
      },
    },
    ...Object.entries(dependencyEdgeVariables).map(([kind, cssVar]) => ({
      selector: `edge[kind = "${kind}"]`,
      style: {
        "line-color": getCssVariable(cssVar) || edgeColor,
        "target-arrow-color": getCssVariable(cssVar) || edgeColor,
      },
    })),
  ];

  return [
    {
      selector: "node",
      style: {
        label: "data(label)",
        "background-color": (ele: cytoscape.NodeSingular) =>
          resolveCytoscapeColor(ele.data("color")) ||
          getCssVariable(kindVariables[ele.data("kind")]) ||
          nodeDefault,
        color: foreground,
        "text-valign": "center",
        "text-halign": "center",
        "font-size": "12px",
        width: "label",
        height: "label",
        padding: "12px",
        "text-wrap": "wrap",
        "text-max-width": "120px",
      },
    },
    {
      selector: "node.selected",
      style: {
        "border-width": 3,
        "border-color": getCssVariable("--color-primary"),
        "border-opacity": 1,
      },
    },
    ...edgeStyles,
  ];
}
