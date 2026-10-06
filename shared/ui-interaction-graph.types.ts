/**
 * Canonical UIInteractionGraph IR (SDE-10).
 * Surfaces/states and transitions are independent of URL and framework.
 * Location: shared/ui-interaction-graph.types.ts
 */

export type UiSurfaceKind =
  | "page"
  | "screen"
  | "view"
  | "window"
  | "modal"
  | "drawer"
  | "tab"
  | "menu"
  | "popover"
  | "unknown";

export type UiTransitionKind =
  | "navigate"
  | "open-surface"
  | "close-surface"
  | "switch-tab"
  | "menu-action"
  | "unknown";

export type UiKnowledgeStatus =
  | "detected"
  | "inferred"
  | "observed"
  | "verified"
  | "conflicted"
  | "unknown";

export type UiEvidenceOrigin = "static" | "runtime" | "heuristic" | "merged" | "user";

export interface UiTrigger {
  label?: string;
  selector?: string;
  testId?: string;
  role?: string;
  href?: string;
  filePath?: string;
  line?: number;
}

export interface UiEvidenceRef {
  id: string;
  kind: string;
  status: UiKnowledgeStatus;
  origin: UiEvidenceOrigin;
  confidence: number;
  /** Redacted summary only — never form secrets. */
  summary: string;
  filePath?: string;
  line?: number;
  attributes?: Record<string, string | number | boolean | null>;
}

export interface UiSurface {
  id: string;
  kind: UiSurfaceKind;
  label: string;
  /** Optional route path — not required for identity. */
  path?: string;
  /** Stable state key e.g. modal:create-project — independent of URL. */
  stateKey?: string;
  parentSurfaceId?: string;
  filePath?: string;
  framework?: string;
  status: UiKnowledgeStatus;
  confidence: number;
  evidenceIds: string[];
  /** Soft attrs; never secrets. */
  attributes?: Record<string, string | number | boolean | null>;
}

export interface UiTransition {
  id: string;
  kind: UiTransitionKind;
  fromSurfaceId: string;
  toSurfaceId: string;
  trigger?: UiTrigger;
  targetPath?: string;
  status: UiKnowledgeStatus;
  confidence: number;
  evidenceIds: string[];
  attributes?: Record<string, string | number | boolean | null>;
}

export interface UiInteractionGraph {
  version: 1;
  projectId: string;
  analyzedAt: string;
  surfaces: UiSurface[];
  transitions: UiTransition[];
  evidence: UiEvidenceRef[];
  stats: {
    surfaceCount: number;
    transitionCount: number;
    routeSurfaceCount: number;
    stateSurfaceCount: number;
    conflictCount: number;
    runtimeOnlyCount: number;
  };
}

/** Legacy Screen-shaped input/output for AppFlow compatibility (SDE-10). */
export type LegacyScreenType = "page" | "screen" | "view" | "modal" | "tab" | "dropdown";

export interface LegacyScreenEdgeTrigger {
  label?: string;
  selector?: string;
  testId?: string;
  file?: string;
  line?: number;
  confidence?: number;
}

export interface LegacyStateTarget {
  targetScreenId: string;
  edgeType: "open-modal" | "switch-tab" | "dropdown-action";
  trigger?: LegacyScreenEdgeTrigger;
}

export interface LegacyScreenLike {
  id: string;
  name: string;
  path: string;
  filePath?: string;
  type?: LegacyScreenType;
  framework?: string;
  parentScreenId?: string;
  parentPath?: string;
  stateKey?: string;
  stateTargets?: LegacyStateTarget[];
  navigatesTo?: string[];
  screenshotUrl?: string;
  /** Optional epistemic status when producer already classified the finding. */
  knowledgeStatus?: UiKnowledgeStatus;
  /** 1-based source line for evidence. */
  evidenceLine?: number;
  confidence?: number;
}
