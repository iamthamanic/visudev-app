/**
 * Normalize UI triggers for AppFlow / UIInteractionGraph (PU-06).
 * Redacts secret-like values; missing meaning → explicit unknown.
 * Location: shared/scan-detector/application/normalize-ui-trigger.ts
 */

import type { UiTrigger } from "../../ui-interaction-graph.types.js";

const SECRETISH = /(password|passwd|secret|token|api[_-]?key|authorization|bearer|cookie|session)/i;

export interface NormalizedUiTrigger {
  trigger: UiTrigger;
  /** True when no human-meaningful control identity survived redaction. */
  isUnknown: boolean;
  displayLabel: string;
}

function redact(value: string | undefined): string | undefined {
  if (value == null) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (SECRETISH.test(trimmed)) return "[redacted]";
  if (/[=:]\s*[^&\s]{12,}/.test(trimmed) && SECRETISH.test(trimmed)) return "[redacted]";
  // Query-like selectors carrying credential params
  if (/[?&](token|key|secret|password)=/i.test(trimmed)) return "[redacted]";
  return trimmed.slice(0, 120);
}

/**
 * Produce a safe trigger for edges/labels. Never invent click targets.
 */
export function normalizeUiTrigger(raw: UiTrigger | undefined | null): NormalizedUiTrigger {
  const label = redact(raw?.label);
  const selector = redact(raw?.selector);
  const testId = redact(raw?.testId);
  const role = redact(raw?.role);
  const href = redact(raw?.href);
  const filePath = raw?.filePath?.trim() || undefined;
  const line = typeof raw?.line === "number" && raw.line > 0 ? raw.line : undefined;

  const trigger: UiTrigger = {
    label,
    selector,
    testId,
    role,
    href,
    filePath,
    line,
  };

  const displayLabel =
    label ||
    (testId ? `testid:${testId}` : undefined) ||
    (role ? `role:${role}` : undefined) ||
    (href ? `href:${href}` : undefined) ||
    (selector ? `sel:${selector}` : undefined) ||
    "unknown";

  const isUnknown = displayLabel === "unknown";

  return { trigger, isUnknown, displayLabel };
}
