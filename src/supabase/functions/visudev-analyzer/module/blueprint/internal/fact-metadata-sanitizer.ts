/** Fact metadata allowlist and string-only redaction for Blueprint export. */

import { redactPiiInText, sanitizeUrlForExport } from "./snippet-sanitizer.ts";

const MAX_METADATA_STRING_LEN = 64;
/** Path-like metadata (resolved imports/calls) needs longer retention than labels. */
const MAX_PATH_STRING_LEN = 512;

const PATH_LIKE_METADATA_KEYS = new Set(["resolvedpath", "targetfile"]);

const ALLOWED_METADATA_KEYS = new Set([
  "method",
  "path",
  "framework",
  "table",
  "operation",
  "status",
  // visudev-gapclose P3-2b: infra-service promotion needs these after export sanitize
  "service",
  "source",
  "provider",
  // P0-9: dependency edges need the resolved target path
  "resolvedpath",
  "targetfile",
  // AUF-3: compose/k8s deploy-service promotion
  "env",
  "region",
  "ports",
  "networks",
  "dependson",
]);

function normalizeMetadataKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]+/g, "_");
}

function looksSensitiveMetadataValue(
  value: string,
  options?: { skipLengthCheck?: boolean },
): boolean {
  if (!options?.skipLengthCheck && value.length > MAX_METADATA_STRING_LEN) {
    return true;
  }
  return /@[a-z0-9.-]+\.[a-z]{2,}|\+?\d{10,}|[0-9a-f]{32,}|\d{3}-\d{2}-\d{4}/i
    .test(value);
}

function sanitizeMetadataString(key: string, value: string): string {
  const normalizedKey = normalizeMetadataKey(key);
  const isPathLike = PATH_LIKE_METADATA_KEYS.has(normalizedKey);
  const maxLen = isPathLike ? MAX_PATH_STRING_LEN : MAX_METADATA_STRING_LEN;
  let next = redactPiiInText(value.trim());
  if (normalizedKey === "path") {
    next = /^https?:\/\//i.test(next)
      ? sanitizeUrlForExport(next)
      : next.slice(0, MAX_METADATA_STRING_LEN);
  } else if (isPathLike) {
    next = next.slice(0, MAX_PATH_STRING_LEN);
  }
  if (looksSensitiveMetadataValue(next, { skipLengthCheck: isPathLike })) {
    return "***";
  }
  return next.slice(0, maxLen);
}

export function sanitizeFactMetadataForExport(
  metadata: Record<string, unknown>,
): Record<string, unknown> {
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    const normalizedKey = normalizeMetadataKey(key);
    if (!ALLOWED_METADATA_KEYS.has(normalizedKey)) continue;
    if (typeof value !== "string") continue;
    next[key] = sanitizeMetadataString(key, value);
  }
  return next;
}
