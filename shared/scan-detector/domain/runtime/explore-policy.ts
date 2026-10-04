/**
 * AppFlow explore modes + interaction risk model (PR-12).
 * Location: shared/scan-detector/domain/runtime/explore-policy.ts
 */

import { isDangerousRuntimeAction } from "./safe-action-policy.js";

export type ExploreMode = "safe" | "sandbox";

export type InteractionRiskClass =
  | "passive"
  | "local-state"
  | "form-input"
  | "mutating"
  | "external"
  | "destructive"
  | "unknown";

export interface ExplorePolicyOptions {
  mode?: ExploreMode;
  /** Required for Sandbox mutating same-origin CRUD. */
  disposable?: boolean;
  pageOrigin?: string | null;
}

export interface ClassifiableCandidate {
  label?: string | null;
  href?: string | null;
  role?: string | null;
  tagName?: string | null;
  type?: string | null;
}

export interface ClassifiableRequest {
  method?: string | null;
  url?: string | null;
  postData?: string | null;
}

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function classifyInteractionRisk(candidate: ClassifiableCandidate): InteractionRiskClass {
  const haystack =
    `${candidate.label ?? ""} ${candidate.href ?? ""} ${candidate.role ?? ""} ${candidate.tagName ?? ""}`.toLowerCase();
  if (isDangerousRuntimeAction(haystack)) {
    if (/\b(buy|purchase|checkout|pay|billing|subscribe)\b/i.test(haystack)) return "external";
    return "destructive";
  }
  if (candidate.href && /^https?:\/\//i.test(candidate.href) && !candidate.href.startsWith("/")) {
    return "external";
  }
  const tag = String(candidate.tagName || "").toLowerCase();
  const type = String(candidate.type || "").toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return "form-input";
  if (type === "submit" || /\b(save|create|update|submit|post)\b/i.test(haystack)) {
    return "mutating";
  }
  if (
    candidate.role === "tab" ||
    candidate.role === "menuitem" ||
    /\b(open|expand|toggle|menu|tab)\b/i.test(haystack)
  ) {
    return "local-state";
  }
  if (tag === "a" || candidate.role === "link" || candidate.href) return "passive";
  if (tag === "button" || candidate.role === "button") return "local-state";
  return "unknown";
}

export function classifyRequestRisk(
  request: ClassifiableRequest,
  pageOrigin?: string | null,
): InteractionRiskClass {
  const method = String(request.method || "GET").toUpperCase();
  const url = String(request.url || "");
  let origin: string | null = null;
  try {
    origin = new URL(url).origin;
  } catch {
    origin = null;
  }
  const post = String(request.postData || "");
  const looksGraphqlMutation =
    /"query"\s*:\s*"[^"]*\bmutation\b/i.test(post) || /^\s*mutation\b/i.test(post);
  if (looksGraphqlMutation) return "mutating";

  if (pageOrigin && origin && origin !== pageOrigin) {
    if (MUTATING_METHODS.has(method) || /\b(checkout|pay|billing)\b/i.test(url)) {
      return "external";
    }
  }
  if (/\b(delete|destroy|drop|truncate)\b/i.test(url + " " + post)) return "destructive";
  if (MUTATING_METHODS.has(method)) return "mutating";
  return "passive";
}

export function isInteractionAllowed(
  risk: InteractionRiskClass,
  options: ExplorePolicyOptions = {},
): boolean {
  const mode = options.mode ?? "safe";
  if (risk === "destructive" || risk === "external") return false;
  if (risk === "passive" || risk === "local-state" || risk === "form-input") return true;
  if (risk === "mutating" || risk === "unknown") {
    if (mode === "sandbox" && options.disposable === true) return true;
    return false;
  }
  return false;
}

export function isRequestAllowed(
  risk: InteractionRiskClass,
  options: ExplorePolicyOptions = {},
): boolean {
  return isInteractionAllowed(risk, options);
}

/** Synthetic typed testdata — never real PII vault values. */
export function syntheticFormValue(input: {
  type?: string | null;
  name?: string | null;
  autocomplete?: string | null;
  tagName?: string | null;
}): string {
  const type = String(input.type || "text").toLowerCase();
  const name = `${input.name ?? ""} ${input.autocomplete ?? ""}`.toLowerCase();
  if (type === "email" || name.includes("email")) return "visudev.safe@example.test";
  if (type === "password") return "SafeExplore-Test-1!";
  if (type === "tel" || name.includes("phone")) return "+4915112345678";
  if (type === "number") return "42";
  if (type === "url") return "https://example.test/visudev-safe";
  if (type === "date") return "2026-01-15";
  if (type === "checkbox" || type === "radio") return "on";
  if (String(input.tagName || "").toLowerCase() === "select") return "";
  if (name.includes("name") || name.includes("user")) return "VisuDev Safe User";
  return "visudev-safe-input";
}

export function redactExploreEvidence(value: string, max = 120): string {
  return String(value || "")
    .replace(/(authorization\s*:\s*bearer\s+)[a-z0-9._-]{12,}/gi, "$1[REDACTED]")
    .replace(/(cookie\s*[:=]\s*)[^;\s]+/gi, "$1[REDACTED]")
    .replace(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi, "[REDACTED_EMAIL]")
    .slice(0, max);
}
