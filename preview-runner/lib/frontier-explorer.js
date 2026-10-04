/**
 * Frontier queue + state identity helpers for AppFlow runtime crawl (PR-10).
 * Location: preview-runner/lib/frontier-explorer.js
 */

export const TERMINATION_REASONS = Object.freeze([
  "frontier-exhausted",
  "budget",
  "timeout",
  "auth-barrier",
  "safety-barrier",
]);

/** Collapse dynamic path segments so /users/123 and /users/456 share identity. */
export function normalizeStateKey(path, extras = {}) {
  const raw =
    String(path || "/")
      .split("?")[0]
      .split("#")[0] || "/";
  const withSlash = raw.startsWith("/") ? raw : `/${raw}`;
  const trimmed =
    withSlash.length > 1 && withSlash.endsWith("/") ? withSlash.slice(0, -1) : withSlash;
  const normalizedPath = trimmed
    .split("/")
    .map((segment) => {
      if (!segment) return segment;
      if (/^[0-9]+$/.test(segment)) return ":id";
      if (
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(segment)
      ) {
        return ":uuid";
      }
      if (/^[0-9a-f]{16,}$/i.test(segment)) return ":hex";
      return segment;
    })
    .join("/");
  const stateHint = extras.stateKey || extras.type || extras.label || "";
  return stateHint ? `${normalizedPath}::${String(stateHint).toLowerCase()}` : normalizedPath;
}

export function createFrontier(seedScreens = []) {
  const queue = [];
  const seen = new Set();
  for (const screen of seedScreens) {
    enqueueFrontier(queue, seen, {
      screenId: screen.id,
      path: screen.path,
      label: screen.name,
      type: screen.type || "route",
      stateKey: screen.stateKey,
      source: "seed",
    });
  }
  return { queue, seen };
}

export function enqueueFrontier(queue, seen, entry) {
  const key = normalizeStateKey(entry.path, {
    stateKey: entry.stateKey,
    type: entry.type,
    label: entry.label,
  });
  if (seen.has(key)) return false;
  seen.add(key);
  queue.push({ ...entry, identityKey: key });
  return true;
}

export function decideTermination({
  queueLength,
  visitCount,
  visitBudget,
  startedAtMs,
  timeoutMs,
  authBarrier,
  safetyBarrier,
}) {
  if (authBarrier) return "auth-barrier";
  if (safetyBarrier) return "safety-barrier";
  if (typeof timeoutMs === "number" && timeoutMs > 0 && Date.now() - startedAtMs >= timeoutMs) {
    return "timeout";
  }
  if (visitCount >= visitBudget) return "budget";
  if (queueLength === 0) return "frontier-exhausted";
  return null;
}

export function looksLikeAuthBarrier(route, title = "") {
  const haystack = `${route} ${title}`.toLowerCase();
  return (
    /(^|\/)(login|signin|sign-in|auth|oauth|sso)(\/|$)/.test(haystack) ||
    /\b(anmelden|login|sign in)\b/.test(haystack)
  );
}
