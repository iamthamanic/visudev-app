/**
 * Evolution sub-tab ids — finished surfaces only (no Working Tree until implemented).
 */

export const EVOLUTION_TABS = [
  { id: "timeline", label: "Timeline" },
  { id: "commit-diff", label: "Commit Diff" },
  { id: "branch-compare", label: "Branch Compare" },
] as const;

export type EvolutionTabId = (typeof EVOLUTION_TABS)[number]["id"];
