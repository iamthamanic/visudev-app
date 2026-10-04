import type { SoftwareGraphEdgeKind } from "../../types";
import type { RelationshipKind } from "../ui/blueprint-relationship-tokens.js";
import { RELATIONSHIP_KINDS } from "../ui/blueprint-relationship-tokens.js";

/** UI filter chips — aligned with Figma Beziehungstypen (8 kinds). */
export const DEPENDENCY_EDGE_KINDS = [
  ...RELATIONSHIP_KINDS,
] as const satisfies readonly RelationshipKind[];

export type DependencyEdgeKind = (typeof DEPENDENCY_EDGE_KINDS)[number];

/** Primary application topology — default Dependencies view (PR-08 / #382). */
export const PRIMARY_TOPOLOGY_EDGE_KINDS = [
  "imports",
  "calls",
  "api",
  "data",
  "event",
  "external",
] as const satisfies readonly DependencyEdgeKind[];

/** Cross-cutting security edges — off by default; enabled via Security overlay. */
export const CROSS_CUTTING_EDGE_KINDS = [
  "auth",
  "validation",
] as const satisfies readonly DependencyEdgeKind[];

export const DEFAULT_VISIBLE_DEPENDENCY_KINDS: DependencyEdgeKind[] = [
  ...PRIMARY_TOPOLOGY_EDGE_KINDS,
];

/** Maps SoftwareGraph edge kinds onto dependency relationship chips. */
export const GRAPH_EDGE_TO_DEPENDENCY: Partial<Record<SoftwareGraphEdgeKind, DependencyEdgeKind>> =
  {
    imports: "imports",
    calls: "calls",
    api: "api",
    data: "data",
    event: "event",
    authenticates: "auth",
    validates: "validation",
    "external-dependency": "external",
  };

export const DEPENDENCY_EDGE_LABELS: Record<DependencyEdgeKind, string> = {
  imports: "Import",
  calls: "Call",
  api: "API",
  event: "Event",
  data: "Data",
  auth: "Auth",
  validation: "Validation",
  external: "External",
};

/** Labels aligned with shared RelationshipChip tokens (Figma Beziehungstypen). */
export const RELATIONSHIP_LABELS: Record<DependencyEdgeKind, string> = {
  imports: "Imports",
  calls: "Calls",
  api: "API Calls",
  data: "Database",
  event: "Events",
  auth: "Auth",
  validation: "Validation",
  external: "External Services",
};

export function resolveDependencyKindFromGraphEdge(
  graphEdgeKind: string,
): DependencyEdgeKind | null {
  return GRAPH_EDGE_TO_DEPENDENCY[graphEdgeKind as SoftwareGraphEdgeKind] ?? null;
}

export function graphEdgeMatchesDependencyKind(
  graphEdgeKind: string,
  dependencyKind: DependencyEdgeKind,
): boolean {
  const mapped = resolveDependencyKindFromGraphEdge(graphEdgeKind);
  return mapped === dependencyKind;
}
