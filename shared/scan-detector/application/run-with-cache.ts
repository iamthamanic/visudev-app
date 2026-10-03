/**
 * Cache-aware orchestrator runner — incremental detector reuse (SDE-13).
 * Location: shared/scan-detector/application/run-with-cache.ts
 */

import type { DetectorRegistry, DetectorRunResult } from "../domain/detector.js";
import type { ScanCacheStore } from "../domain/cache/cache-store.js";
import { planIncrementalScan } from "../domain/snapshot/invalidation.js";
import { buildSnapshotKey } from "../domain/snapshot/snapshot-key.js";
import type { ScanCacheEntry } from "../domain/snapshot/types.js";
import { isSnapshotCompatible } from "../domain/snapshot/compatibility.js";
import { redactFactsAndEvidence } from "../domain/evidence/redact.js";
import type { ScanSnapshot, ScanVersionManifest } from "../types.js";
import {
  ScanDetectorOrchestrator,
  type OrchestratorInput,
  type OrchestratorPorts,
} from "./orchestrator.js";

export interface RunWithCacheInput extends OrchestratorInput {
  applicationScopeId?: string;
  dirtyFingerprint: string;
  /** Current per-detector input fingerprints (caller-computed). */
  detectorInputFingerprints: Record<string, string>;
  modelVersions?: ScanVersionManifest["modelVersions"];
  /** Optional path hints for prefix-based invalidation. */
  changedPaths?: readonly string[];
}

export interface RunWithCacheResult {
  snapshot: ScanSnapshot;
  detectorResults: DetectorRunResult[];
  cacheKey: string;
  cacheHits: string[];
  cacheMisses: string[];
  reusedFromKey: string | null;
}

function factsForDetectors(
  snapshot: ScanSnapshot,
  detectorIds: readonly string[],
): { facts: ScanSnapshot["facts"]; evidence: ScanSnapshot["evidence"] } {
  const idSet = new Set(detectorIds);
  const facts = snapshot.facts.filter((fact) => idSet.has(fact.provenance.detectorId));
  const evidenceIds = new Set(facts.flatMap((fact) => fact.evidenceIds));
  const evidence = snapshot.evidence.filter(
    (item) => idSet.has(item.provenance.detectorId) || evidenceIds.has(item.id),
  );
  return { facts, evidence };
}

/**
 * Run detectors with cache: reuse unchanged detector slices, rerun the rest,
 * persist a redacted combined snapshot under the versioned key.
 */
export async function runWithCache(
  registry: DetectorRegistry,
  store: ScanCacheStore,
  input: RunWithCacheInput,
  ports: OrchestratorPorts = {},
): Promise<RunWithCacheResult> {
  const requested = input.requestedCapabilityIds ?? [];
  const selected = registry.select(requested);
  const detectorVersions = Object.fromEntries(
    selected.map((detector) => [detector.id, detector.capability.version]),
  );
  const modelVersions = input.modelVersions ?? {};
  const applicationScopeId = input.applicationScopeId?.trim() || "_";
  const versions: ScanVersionManifest = {
    engineVersion: input.engineVersion,
    modelVersions,
    detectorVersions,
  };

  const cacheKey = buildSnapshotKey({
    projectId: input.projectId,
    applicationScopeId,
    commitSha: input.repo?.commitSha ?? "",
    ref: input.repo?.branch ?? "HEAD",
    dirtyFingerprint: input.dirtyFingerprint,
    engineVersion: input.engineVersion,
    modelVersions,
    detectorVersions,
  });

  let previous: ScanCacheEntry | null = null;
  try {
    previous = await store.get(cacheKey);
  } catch {
    previous = null;
  }

  if (previous && !isSnapshotCompatible(previous.versions, versions)) {
    previous = null;
  }

  // Also try listing same commit clean entry when dirty fingerprint differs — skip;
  // key already encodes dirty. For incremental within same key, use fingerprints.

  const detectorIds = selected.map((detector) => detector.id);
  const plan = planIncrementalScan({
    previous,
    requestedDetectorIds: detectorIds,
    currentInputFingerprints: input.detectorInputFingerprints,
    currentVersions: versions,
    changedPaths: input.changedPaths,
  });

  const orchestrator = new ScanDetectorOrchestrator(registry, ports);
  const rerunCapabilities = selected
    .filter((detector) => plan.rerunDetectorIds.includes(detector.id))
    .map((detector) => detector.capability.id);

  let freshResults: DetectorRunResult[] = [];
  let freshSnapshot: ScanSnapshot | null = null;
  if (rerunCapabilities.length > 0 || plan.cacheHitDetectorIds.length === 0) {
    const runResult = await orchestrator.run({
      ...input,
      requestedCapabilityIds: rerunCapabilities.length > 0 ? rerunCapabilities : requested,
    });
    freshResults = runResult.detectorResults;
    freshSnapshot = runResult.snapshot;
  }

  const reused =
    previous && plan.cacheHitDetectorIds.length > 0
      ? factsForDetectors(previous.snapshot, plan.cacheHitDetectorIds)
      : { facts: [], evidence: [] };

  const freshFacts = freshSnapshot?.facts ?? [];
  const freshEvidence = freshSnapshot?.evidence ?? [];
  const mergedRaw = redactFactsAndEvidence(
    [...reused.facts, ...freshFacts],
    [...reused.evidence, ...freshEvidence],
  );

  const capabilities = selected.map((detector) => detector.capability);
  const snapshot: ScanSnapshot = {
    version: 1,
    projectId: input.projectId,
    analyzedAt: input.analyzedAt,
    enrichment: input.enrichment,
    repo: {
      ...(input.repo ?? {}),
      dirty: input.dirtyFingerprint !== "clean",
    },
    versions,
    capabilities,
    facts: mergedRaw.facts,
    evidence: mergedRaw.evidence,
  };

  const entry: ScanCacheEntry = {
    key: cacheKey,
    projectId: input.projectId,
    applicationScopeId,
    createdAt: input.analyzedAt,
    versions,
    repo: {
      ...(input.repo ?? {}),
      dirtyFingerprint: input.dirtyFingerprint,
    },
    detectorInputFingerprints: { ...input.detectorInputFingerprints },
    snapshot,
  };

  await store.put(entry);

  const syntheticHits: DetectorRunResult[] = plan.cacheHitDetectorIds.map((detectorId) => ({
    detectorId,
    status: "success" as const,
    facts: reused.facts.filter((fact) => fact.provenance.detectorId === detectorId),
    evidence: reused.evidence.filter((item) => item.provenance.detectorId === detectorId),
  }));

  return {
    snapshot,
    detectorResults: [...syntheticHits, ...freshResults],
    cacheKey,
    cacheHits: [...plan.cacheHitDetectorIds],
    cacheMisses: [...plan.rerunDetectorIds],
    reusedFromKey: previous && plan.cacheHitDetectorIds.length > 0 ? previous.key : null,
  };
}
