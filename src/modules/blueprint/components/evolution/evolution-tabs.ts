/**
 * Evolution sub-tab ids — V1 ships only finished surfaces (PR-17).
 * Commit Diff / Working Tree stay out until implemented (no fake tabs).
 */

export const EVOLUTION_TABS = [
  { id: "timeline", label: "Timeline" },
  { id: "branch-compare", label: "Branch Compare" },
] as const;

export type EvolutionTabId = (typeof EVOLUTION_TABS)[number]["id"];
