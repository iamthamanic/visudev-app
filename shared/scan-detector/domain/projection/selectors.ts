/**
 * Kind-prefix selectors for projection slices (SDE-07).
 * Selectors only match already-classified fact kinds — no framework inference.
 * Location: shared/scan-detector/domain/projection/selectors.ts
 */

import type { ScanFact } from "../../types.js";
import type { ProjectionSlice } from "./types.js";

/** Blueprint node facts from static graph / semantic adapters. */
export const BLUEPRINT_ENTITY_KIND_PREFIXES = ["graph-node:", "semantic-entity:"] as const;

/** Blueprint edge / relation facts. */
export const BLUEPRINT_RELATION_KIND_PREFIXES = ["graph-edge:", "semantic-relation:"] as const;

/** AppFlow screen facts (emitted by UI/runtime detectors — not inferred here). */
export const APPFLOW_SCREEN_KIND_PREFIXES = ["ui-screen:", "appflow-screen:"] as const;

/** AppFlow flow facts. */
export const APPFLOW_FLOW_KIND_PREFIXES = ["ui-flow:", "appflow-flow:"] as const;

/** AppFlow transition / navigation facts. */
export const APPFLOW_TRANSITION_KIND_PREFIXES = ["ui-transition:", "appflow-transition:"] as const;

/** Data table facts. */
export const DATA_TABLE_KIND_PREFIXES = ["data-table:", "graph-node:table"] as const;

/** Data relation / FK facts. */
export const DATA_RELATION_KIND_PREFIXES = [
  "data-relation:",
  "graph-edge:fk",
  "graph-edge:references",
] as const;

function startsWithAny(value: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) => value.startsWith(prefix));
}

export function isBlueprintEntityFact(fact: ScanFact): boolean {
  return startsWithAny(fact.kind, BLUEPRINT_ENTITY_KIND_PREFIXES);
}

export function isBlueprintRelationFact(fact: ScanFact): boolean {
  return startsWithAny(fact.kind, BLUEPRINT_RELATION_KIND_PREFIXES);
}

export function isAppFlowScreenFact(fact: ScanFact): boolean {
  return startsWithAny(fact.kind, APPFLOW_SCREEN_KIND_PREFIXES);
}

export function isAppFlowFlowFact(fact: ScanFact): boolean {
  return startsWithAny(fact.kind, APPFLOW_FLOW_KIND_PREFIXES);
}

export function isAppFlowTransitionFact(fact: ScanFact): boolean {
  return startsWithAny(fact.kind, APPFLOW_TRANSITION_KIND_PREFIXES);
}

export function isDataTableFact(fact: ScanFact): boolean {
  return startsWithAny(fact.kind, DATA_TABLE_KIND_PREFIXES);
}

export function isDataRelationFact(fact: ScanFact): boolean {
  return startsWithAny(fact.kind, DATA_RELATION_KIND_PREFIXES);
}

/** True when a fact kind is claimed by any documented projection selector. */
export function isProjectionClaimedFact(fact: ScanFact, slice: ProjectionSlice): boolean {
  switch (slice) {
    case "blueprint":
      return isBlueprintEntityFact(fact) || isBlueprintRelationFact(fact);
    case "appflow":
      return isAppFlowScreenFact(fact) || isAppFlowFlowFact(fact) || isAppFlowTransitionFact(fact);
    case "data":
      return isDataTableFact(fact) || isDataRelationFact(fact);
    default: {
      const _exhaustive: never = slice;
      return _exhaustive;
    }
  }
}
