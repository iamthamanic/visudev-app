/**
 * Runtime-neutral ScanDetectorEngine contracts (SDE-02).
 * Pure TypeScript domain types — no Node/Deno/DOM/React/Supabase imports.
 * Location: shared/scan-detector/types.ts
 */

/** Epistemic status for facts and evidence (Epic #335). */
export type ScanKnowledgeStatus =
  | "detected"
  | "inferred"
  | "observed"
  | "verified"
  | "conflicted"
  | "unknown";

/** Where a claim originated. LLM is never authoritative. */
export type ScanEvidenceOriginKind =
  | "static"
  | "runtime"
  | "data"
  | "heuristic"
  | "llm"
  | "user"
  | "merged";

export type ScanConfidence = number;

export interface ScanProvenance {
  originKind: ScanEvidenceOriginKind;
  /** Detector id that produced the claim (e.g. `static-imports-v1`). */
  detectorId: string;
  /** Optional human-readable detector/version label. */
  detectorVersion?: string;
  /** ISO timestamp when the claim was produced. */
  producedAt?: string;
  /** True when an LLM suggested the claim; never authoritative alone. */
  llmSuggested?: boolean;
}

/**
 * Redaction-capable evidence payload.
 * Secrets, tokens, and raw sensitive DB rows must not be persisted here.
 */
export interface ScanEvidencePayload {
  /** Sanitized excerpt or structured summary only. */
  summary?: string;
  /** Relative file path when applicable. */
  filePath?: string;
  line?: number;
  /** Opaque structured fields already redacted by adapters. */
  attributes?: Record<string, string | number | boolean | null>;
}

export interface ScanEvidence {
  id: string;
  kind: string;
  status: ScanKnowledgeStatus;
  confidence: ScanConfidence;
  provenance: ScanProvenance;
  payload: ScanEvidencePayload;
  /** Soft refs to related fact ids. */
  factIds?: string[];
}

export interface ScanFact {
  id: string;
  kind: string;
  status: ScanKnowledgeStatus;
  confidence: ScanConfidence;
  provenance: ScanProvenance;
  /** Stable subject identity (graph node, route, table, screen, …). */
  subjectId: string;
  /** Optional object identity for relational facts. */
  objectId?: string;
  evidenceIds: string[];
  /** Soft attributes — never secrets. */
  attributes?: Record<string, string | number | boolean | null>;
}

export interface DetectorCapability {
  id: string;
  /** Human label for manifests / diagnostics. */
  label: string;
  /** Capability family, e.g. `static-ast`, `runtime-crawl`, `schema-introspect`. */
  family: string;
  version: string;
  /** Languages/frameworks this detector can claim; empty = unspecified. */
  supports?: string[];
}

export interface ScanRepoMetadata {
  /** Absolute or workspace-relative path when known; never required for cloud. */
  localPath?: string;
  remoteUrl?: string;
  commitSha?: string;
  branch?: string;
  dirty?: boolean;
  /** True when the scan covered only a partial tree. */
  partial?: boolean;
}

export interface ScanVersionManifest {
  engineVersion: string;
  modelVersions: {
    softwareGraph?: string;
    semanticSystemModel?: string;
    uiInteractionGraph?: string;
    dataGraph?: string;
  };
  detectorVersions: Record<string, string>;
}

export interface ScanSnapshot {
  version: 1;
  projectId: string;
  analyzedAt: string;
  enrichment: "off" | "on" | "unknown";
  repo: ScanRepoMetadata;
  versions: ScanVersionManifest;
  capabilities: DetectorCapability[];
  facts: ScanFact[];
  evidence: ScanEvidence[];
}

/** Type guards kept free of runtime I/O. */
export function isScanKnowledgeStatus(value: unknown): value is ScanKnowledgeStatus {
  return (
    value === "detected" ||
    value === "inferred" ||
    value === "observed" ||
    value === "verified" ||
    value === "conflicted" ||
    value === "unknown"
  );
}

export function isAuthoritativeEvidence(evidence: ScanEvidence): boolean {
  if (evidence.provenance.originKind === "llm" || evidence.provenance.llmSuggested === true) {
    return false;
  }
  return (
    evidence.status === "detected" ||
    evidence.status === "observed" ||
    evidence.status === "verified"
  );
}
