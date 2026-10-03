/**
 * Semantic architecture history for Evolution (RVP-11).
 * Consumes #348 snapshot keys / HistoricalSnapshotRecord — no second cache.
 * Location: shared/semantic-history.ts
 */

import { buildSemanticSystemModel } from "./semantic-system-model.js";
import type { SemanticSystemModel } from "./semantic-system-model.types.js";
import type { SoftwareGraph, SoftwareGraphSnapshot } from "./software-graph.types.js";
import { scanFactsToSoftwareGraph } from "./scan-detector/application/software-graph-fact-bridge.js";
import { buildSnapshotKey } from "./scan-detector/domain/snapshot/snapshot-key.js";
import type { HistoricalSnapshotRecord } from "./scan-detector/domain/snapshot/types.js";
import type { ScanSnapshot } from "./scan-detector/types.js";

export interface SemanticHistorySnapshot {
  /** #348-compatible snapshot key when available. */
  key: string;
  projectId: string;
  commitSha: string;
  ref: string;
  analyzedAt: string;
  engineVersion: string;
  /** entityId → kind:label signature */
  entitySignatures: Record<string, string>;
  /** relationId → kind:source→target signature */
  relationSignatures: Record<string, string>;
}

export interface SemanticHistoryDiff {
  baseKey: string;
  targetKey: string;
  addedEntityIds: string[];
  removedEntityIds: string[];
  changedEntityIds: string[];
  addedRelationIds: string[];
  removedRelationIds: string[];
  changedRelationIds: string[];
  identical: boolean;
}

function sortedRecord(record: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of Object.keys(record).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))) {
    out[key] = record[key] ?? "";
  }
  return out;
}

export function signaturesFromSemanticModel(model: SemanticSystemModel): {
  entitySignatures: Record<string, string>;
  relationSignatures: Record<string, string>;
} {
  const entitySignatures: Record<string, string> = {};
  for (const entity of model.entities) {
    entitySignatures[entity.id] = `${entity.kind}:${entity.label}`;
  }
  const relationSignatures: Record<string, string> = {};
  for (const relation of model.relations) {
    relationSignatures[relation.id] = `${relation.kind}:${relation.sourceId}->${relation.targetId}`;
  }
  return {
    entitySignatures: sortedRecord(entitySignatures),
    relationSignatures: sortedRecord(relationSignatures),
  };
}

export function buildSemanticHistoryFromModel(
  model: SemanticSystemModel,
  options: {
    key: string;
    commitSha: string;
    ref: string;
    engineVersion: string;
  },
): SemanticHistorySnapshot {
  const { entitySignatures, relationSignatures } = signaturesFromSemanticModel(model);
  return {
    key: options.key,
    projectId: model.projectId,
    commitSha: options.commitSha,
    ref: options.ref,
    analyzedAt: model.analyzedAt,
    engineVersion: options.engineVersion,
    entitySignatures,
    relationSignatures,
  };
}

export function buildSemanticHistoryFromSoftwareGraph(
  graph: SoftwareGraph,
  options: {
    key: string;
    commitSha: string;
    ref: string;
    engineVersion: string;
  },
): SemanticHistorySnapshot {
  return buildSemanticHistoryFromModel(buildSemanticSystemModel(graph), options);
}

export function buildSemanticHistoryFromScanSnapshot(
  scan: ScanSnapshot,
  applicationScopeId = "_",
): SemanticHistorySnapshot {
  const graph = scanFactsToSoftwareGraph(scan.projectId, scan.analyzedAt, scan.facts);
  const key = buildSnapshotKey({
    projectId: scan.projectId,
    applicationScopeId,
    commitSha: scan.repo.commitSha ?? "",
    ref: scan.repo.branch ?? "HEAD",
    dirtyFingerprint: scan.repo.dirty ? "dirty" : "clean",
    engineVersion: scan.versions.engineVersion,
    modelVersions: scan.versions.modelVersions,
    detectorVersions: scan.versions.detectorVersions,
  });
  return buildSemanticHistoryFromSoftwareGraph(graph, {
    key,
    commitSha: scan.repo.commitSha ?? "",
    ref: scan.repo.branch ?? "HEAD",
    engineVersion: scan.versions.engineVersion,
  });
}

export function buildSemanticHistoryFromHistoricalRecord(
  record: HistoricalSnapshotRecord,
): SemanticHistorySnapshot {
  return buildSemanticHistoryFromScanSnapshot(record.snapshot, record.applicationScopeId);
}

function diffSignatureMaps(
  base: Record<string, string>,
  target: Record<string, string>,
): { added: string[]; removed: string[]; changed: string[] } {
  const added: string[] = [];
  const removed: string[] = [];
  const changed: string[] = [];
  const baseIds = new Set(Object.keys(base));
  const targetIds = new Set(Object.keys(target));
  for (const id of targetIds) {
    if (!baseIds.has(id)) {
      added.push(id);
      continue;
    }
    if (base[id] !== target[id]) changed.push(id);
  }
  for (const id of baseIds) {
    if (!targetIds.has(id)) removed.push(id);
  }
  added.sort();
  removed.sort();
  changed.sort();
  return { added, removed, changed };
}

export function diffSemanticHistory(
  base: SemanticHistorySnapshot,
  target: SemanticHistorySnapshot,
): SemanticHistoryDiff {
  const entities = diffSignatureMaps(base.entitySignatures, target.entitySignatures);
  const relations = diffSignatureMaps(base.relationSignatures, target.relationSignatures);
  const identical =
    entities.added.length === 0 &&
    entities.removed.length === 0 &&
    entities.changed.length === 0 &&
    relations.added.length === 0 &&
    relations.removed.length === 0 &&
    relations.changed.length === 0;

  return {
    baseKey: base.key,
    targetKey: target.key,
    addedEntityIds: entities.added,
    removedEntityIds: entities.removed,
    changedEntityIds: entities.changed,
    addedRelationIds: relations.added,
    removedRelationIds: relations.removed,
    changedRelationIds: relations.changed,
    identical,
  };
}

/** Project semantic history into a SoftwareGraphSnapshot for Evolution UI. */
export function semanticHistoryToGraphSnapshot(
  history: SemanticHistorySnapshot,
): SoftwareGraphSnapshot {
  const nodeIds = Object.keys(history.entitySignatures);
  return {
    id: history.key,
    label: history.commitSha ? history.commitSha.slice(0, 8) : history.ref,
    ref: history.ref,
    capturedAt: history.analyzedAt,
    commitSha: history.commitSha || undefined,
    sourceKind: "git",
    dirty: false,
    nodeIds,
    nodeSignatures: { ...history.entitySignatures },
  };
}

/**
 * Merge ≥2 historical engine records into a graph's snapshot list for Evolution.
 * Preserves existing snapshots; historical engine keys win on id collision.
 */
export function attachHistoricalEngineSnapshots(
  graph: SoftwareGraph,
  records: readonly HistoricalSnapshotRecord[],
): SoftwareGraph {
  const fromHistory = records.map((record) =>
    semanticHistoryToGraphSnapshot(buildSemanticHistoryFromHistoricalRecord(record)),
  );
  const existing = Array.isArray(graph.snapshots) ? graph.snapshots : [];
  const byId = new Map<string, SoftwareGraphSnapshot>();
  for (const snapshot of existing) byId.set(snapshot.id, snapshot);
  for (const snapshot of fromHistory) byId.set(snapshot.id, snapshot);
  const snapshots = [...byId.values()].sort((a, b) =>
    a.capturedAt < b.capturedAt ? -1 : a.capturedAt > b.capturedAt ? 1 : 0,
  );
  return { ...graph, snapshots };
}

export function hasSemanticHistoryCompare(snapshots: readonly SoftwareGraphSnapshot[]): boolean {
  return snapshots.length >= 2;
}
