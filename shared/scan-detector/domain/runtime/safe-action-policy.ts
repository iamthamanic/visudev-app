/**
 * Safe-action policy for runtime observers (SDE-09).
 * Blocks destructive / payment / auth side-effects by default.
 * Location: shared/scan-detector/domain/runtime/safe-action-policy.ts
 */

/** Labels/hrefs matching these tokens are never auto-clicked. */
export const DANGEROUS_RUNTIME_ACTION_RE =
  /\b(delete|remove|destroy|drop|truncate|logout|sign[\s_-]?out|signout|buy|purchase|checkout|pay|billing|subscribe|send|deploy|uninstall)\b/i;

export interface RuntimeInteractionCandidate {
  label?: string | null;
  href?: string | null;
  role?: string | null;
  visible?: boolean;
  enabled?: boolean;
}

export function isDangerousRuntimeAction(text: string): boolean {
  return DANGEROUS_RUNTIME_ACTION_RE.test(String(text || ""));
}

/**
 * Returns true when a DOM interaction candidate is safe to automate.
 * Invisible/disabled controls and dangerous labels are rejected.
 */
export function isSafeRuntimeInteractionCandidate(candidate: RuntimeInteractionCandidate): boolean {
  if (candidate.visible === false || candidate.enabled === false) return false;
  const haystack =
    `${candidate.label ?? ""} ${candidate.href ?? ""} ${candidate.role ?? ""}`.trim();
  if (!haystack) return true;
  return !isDangerousRuntimeAction(haystack);
}
