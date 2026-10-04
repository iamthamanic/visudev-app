/**
 * Browser console cleanliness gate for Product Readiness (#391).
 * Fails on console.error, pageerror, React duplicate-key, unhandled exceptions.
 * Location: scripts/readiness/assert-browser-console.mjs
 */

/** @typedef {{ passed: boolean, failures: string[], summary: Record<string, unknown> }} ConsoleAssertResult */

const FAIL_PATTERNS = [
  { id: "console-error", re: /^\[error\]\s+/i },
  { id: "pageerror", re: /^\[pageerror\]\s+/i },
  { id: "duplicate-react-key", re: /Encountered two children with the same key/i },
  { id: "unhandled-rejection", re: /unhandledrejection|Unhandled Promise Rejection/i },
];

/** Narrow allowlist — never mask React keys / pageerrors. */
const ALLOWLIST = [/Failed to load resource:.*favicon\.ico/i, /Download the React DevTools/i];

/**
 * @param {string[]} consoleLines
 * @returns {ConsoleAssertResult}
 */
export function assertBrowserConsole(consoleLines) {
  const lines = Array.isArray(consoleLines) ? consoleLines : [];
  const failures = [];
  const matched = [];

  for (const line of lines) {
    const text = String(line ?? "");
    if (!text.trim()) continue;
    if (ALLOWLIST.some((re) => re.test(text))) continue;
    for (const pattern of FAIL_PATTERNS) {
      if (pattern.re.test(text)) {
        failures.push(`${pattern.id}: ${text.slice(0, 240)}`);
        matched.push(pattern.id);
        break;
      }
    }
  }

  return {
    passed: failures.length === 0,
    failures,
    summary: {
      lineCount: lines.length,
      failureCount: failures.length,
      matchedIds: [...new Set(matched)],
    },
  };
}
