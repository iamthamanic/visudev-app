/**
 * SemanticSystemModel v2 classification helpers (#379).
 * Separates technical/resource labels from business-domain candidates.
 * Location: shared/semantic-taxonomy-v2.ts
 */

import type { KnowledgeStatus } from "./scan-detector/epistemic.js";

/**
 * Names that must never become business-domain / capability from heuristics alone
 * (Resource→Business-Domain misclassification golden set).
 */
export const RESOURCE_NOT_BUSINESS_DOMAIN = new Set([
  "logo",
  "seed",
  "pending",
  "template",
  "templates",
  "role",
  "roles",
  "token",
  "tokens",
  "session",
  "sessions",
  "cookie",
  "cookies",
  "fixture",
  "fixtures",
  "mock",
  "mocks",
  "stub",
  "stubs",
  "placeholder",
  "placeholders",
  "icon",
  "icons",
  "asset",
  "assets",
  "image",
  "images",
  "avatar",
  "avatars",
  "badge",
  "badges",
  "button",
  "buttons",
  "modal",
  "modals",
  "dialog",
  "dialogs",
  "theme",
  "themes",
  "style",
  "styles",
  "css",
  "i18n",
  "locale",
  "locales",
  "translation",
  "translations",
]);

const SECURITY_CONTROL_LABEL =
  /^(?:auth[-_. ]?check|authentication|authorization|rls|csrf|cors|rate[-_. ]?limit|validation[-_. ]?deny)/i;

/**
 * Map weak/strong evidence to KnowledgeStatus.
 * Heuristic / single-signal → at most INTERPRETED.
 */
export function knowledgeStatusFromSignals(input: {
  sourceKindCount: number;
  maxConfidence: number;
  origin?: "static" | "heuristic" | "llm";
}): KnowledgeStatus {
  if (input.origin === "llm") return "INTERPRETED";
  if (input.sourceKindCount >= 2 && input.maxConfidence >= 0.9) return "VERIFIED";
  if (input.sourceKindCount >= 2 || input.maxConfidence >= 0.9) return "SUPPORTED";
  if (input.maxConfidence >= 0.5) return "INTERPRETED";
  return "UNKNOWN";
}

export function isResourceNotBusinessDomain(candidateKey: string): boolean {
  return RESOURCE_NOT_BUSINESS_DOMAIN.has(candidateKey.trim().toLowerCase());
}

export function isSecurityControlLabel(label: string): boolean {
  return SECURITY_CONTROL_LABEL.test(label.trim());
}

/**
 * Business-domain requires multi-signal evidence, or a strong non-path source
 * (table / named service|repository). A single path segment (route-only) is never enough.
 */
export function qualifiesAsBusinessDomain(sourceKinds: readonly string[]): boolean {
  const kinds = new Set(sourceKinds);
  if (kinds.size >= 2) return true;
  if (kinds.has("table") || kinds.has("service") || kinds.has("repository")) return true;
  return false;
}
