/**
 * Safe-action policy for runtime observers (SDE-09) — ESM for preview-runner.
 * Keep in sync with safe-action-policy.ts
 * Location: shared/scan-detector/domain/runtime/safe-action-policy.mjs
 */

export const DANGEROUS_RUNTIME_ACTION_RE =
  /\b(delete|remove|destroy|drop|truncate|logout|sign[\s_-]?out|signout|buy|purchase|checkout|pay|billing|subscribe|send|deploy|uninstall)\b/i;

/**
 * @param {string} text
 * @returns {boolean}
 */
export function isDangerousRuntimeAction(text) {
  return DANGEROUS_RUNTIME_ACTION_RE.test(String(text || ""));
}

/**
 * @param {{ label?: string|null, href?: string|null, role?: string|null, visible?: boolean, enabled?: boolean }} candidate
 * @returns {boolean}
 */
export function isSafeRuntimeInteractionCandidate(candidate) {
  if (candidate.visible === false || candidate.enabled === false) return false;
  const haystack =
    `${candidate.label ?? ""} ${candidate.href ?? ""} ${candidate.role ?? ""}`.trim();
  if (!haystack) return true;
  return !isDangerousRuntimeAction(haystack);
}
