/**
 * Runtime crawl DTO shared by engine normalization (SDE-09).
 * Mirrors preview-runner RuntimeCrawlResult without Playwright imports.
 * Location: shared/scan-detector/domain/runtime/crawl-result.ts
 */

export interface RuntimeObserverTrigger {
  label?: string;
  role?: string;
  href?: string;
  selector?: string;
  testId?: string;
}

export interface RuntimeObserverRouteSnapshot {
  screenId: string;
  route: string;
  title?: string;
  interactiveCount: number;
  containerCount: number;
  openContainerCount: number;
}

export interface RuntimeObserverVerifiedEdge {
  fromScreenId: string;
  toScreenId?: string;
  type: "navigate" | "open-modal" | "switch-tab" | "dropdown-action";
  targetPath?: string;
  trigger?: RuntimeObserverTrigger;
  verification: "route-change" | "state-change";
  sourceRoute: string;
  targetRoute?: string;
  matchedBy?: "path" | "parent-state" | "label";
  /** Screenshot URLs must not include auth tokens; adapters redact before persist. */
  screenshotUrl?: string;
}

export interface RuntimeObserverStateCapture {
  screenId?: string;
  parentScreenId: string;
  type: "modal" | "tab" | "dropdown";
  label?: string;
  screenshotUrl?: string;
  matchedBy?: "parent-state" | "label";
  trigger?: RuntimeObserverTrigger;
}

export type RuntimeObserverIssueCode =
  | "click_failed"
  | "screen_load_failed"
  | "no_interactive_candidates"
  | "graph_without_runtime_match"
  | "dom_without_graph_match"
  | "auth_required"
  | "captcha_blocked"
  | "timeout";

export interface RuntimeObserverIssue {
  code: RuntimeObserverIssueCode;
  severity: "info" | "warning" | "high";
  message: string;
  screenId?: string;
  targetScreenId?: string;
  triggerLabel?: string;
}

export interface RuntimeObserverSummary {
  visitedScreens: number;
  attemptedClicks: number;
  verifiedEdges: number;
  stateCaptures: number;
  mismatchCount: number;
  issueCount: number;
}

export interface RuntimeObserverCrawlResult {
  baseUrl: string;
  crawledAt: string;
  summary: RuntimeObserverSummary;
  snapshots: RuntimeObserverRouteSnapshot[];
  verifiedEdges: RuntimeObserverVerifiedEdge[];
  stateScreens: RuntimeObserverStateCapture[];
  issues: RuntimeObserverIssue[];
}
