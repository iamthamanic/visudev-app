/**
 * Evidence redaction helpers (SDE-05) — strip secret-like attribute values before persist.
 * Location: shared/scan-detector/domain/evidence/redact.ts
 */

import type { ScanEvidence, ScanEvidencePayload, ScanFact } from "../../types.js";

const SECRET_KEY =
  /^(password|passwd|secret|token|api[_-]?key|authorization|cookie|private[_-]?key)$/i;
const SECRET_VALUE = /(bearer\s+[a-z0-9\-._~+/]+=*|sk-[a-z0-9]{16,}|xox[baprs]-[a-z0-9-]+)/i;

function redactAttributes(
  attributes: Record<string, string | number | boolean | null> | undefined,
): Record<string, string | number | boolean | null> | undefined {
  if (!attributes) return undefined;
  const next: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(attributes)) {
    if (SECRET_KEY.test(key)) {
      next[key] = "[redacted]";
      continue;
    }
    if (typeof value === "string" && SECRET_VALUE.test(value)) {
      next[key] = "[redacted]";
      continue;
    }
    next[key] = value;
  }
  return next;
}

function redactPayload(payload: ScanEvidencePayload): ScanEvidencePayload {
  return {
    ...payload,
    summary:
      typeof payload.summary === "string" && SECRET_VALUE.test(payload.summary)
        ? "[redacted]"
        : payload.summary,
    attributes: redactAttributes(payload.attributes),
  };
}

export function redactEvidence(evidence: ScanEvidence): ScanEvidence {
  return { ...evidence, payload: redactPayload(evidence.payload) };
}

export function redactFact(fact: ScanFact): ScanFact {
  return { ...fact, attributes: redactAttributes(fact.attributes) };
}

export function redactFactsAndEvidence(
  facts: readonly ScanFact[],
  evidence: readonly ScanEvidence[],
): { facts: ScanFact[]; evidence: ScanEvidence[] } {
  return {
    facts: facts.map(redactFact),
    evidence: evidence.map(redactEvidence),
  };
}
