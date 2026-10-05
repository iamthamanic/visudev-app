/**
 * Compares two SoftwareGraph snapshots into diff metadata for EvolutionView.
 * Prefer semantic entity/relation signatures; refuse incompatible engine majors.
 */

import { areSnapshotsComparable } from "../../../../../shared/semantic-history.js";
import type { SoftwareGraph, SoftwareGraphDiffMetadata, SoftwareGraphSnapshot } from "../../types";

const MAX_DIFF_IDS = 500;

export function findSnapshot(
  graph: SoftwareGraph,
  snapshotId: string,
): SoftwareGraphSnapshot | undefined {
  const snapshots = Array.isArray(graph.snapshots) ? graph.snapshots : [];
  return snapshots.find((snapshot) => snapshot.id === snapshotId);
}

function readSignature(snapshot: SoftwareGraphSnapshot, nodeId: string): string | undefined {
  return snapshot.nodeSignatures?.[nodeId];
}

function diffIdSets(
  baseIds: Set<string>,
  targetIds: Set<string>,
  baseSig: (id: string) => string | undefined,
  targetSig: (id: string) => string | undefined,
): { added: string[]; removed: string[]; changed: string[] } {
  const added: string[] = [];
  const removed: string[] = [];
  const changed: string[] = [];
  for (const id of targetIds) {
    if (!baseIds.has(id)) {
      added.push(id);
      continue;
    }
    const left = baseSig(id);
    const right = targetSig(id);
    if (left && right && left !== right) changed.push(id);
  }
  for (const id of baseIds) {
    if (!targetIds.has(id)) removed.push(id);
  }
  return { added, removed, changed };
}

export function diffSnapshots(
  _graph: SoftwareGraph,
  baseSnapshot: SoftwareGraphSnapshot,
  targetSnapshot: SoftwareGraphSnapshot,
): SoftwareGraphDiffMetadata {
  const compatibility = areSnapshotsComparable(baseSnapshot, targetSnapshot);
  if (!compatibility.comparable) {
    return {
      baseSnapshotId: baseSnapshot.id,
      targetSnapshotId: targetSnapshot.id,
      addedNodeIds: [],
      removedNodeIds: [],
      changedNodeIds: [],
      addedRelationIds: [],
      removedRelationIds: [],
      changedRelationIds: [],
      identical: false,
      condensed: false,
      comparable: false,
      incompatibleReason: compatibility.reason,
    };
  }

  const baseNodeIds = new Set(baseSnapshot.nodeIds);
  const targetNodeIds = new Set(targetSnapshot.nodeIds);
  const nodes = diffIdSets(
    baseNodeIds,
    targetNodeIds,
    (id) => readSignature(baseSnapshot, id),
    (id) => readSignature(targetSnapshot, id),
  );

  const baseRelations = baseSnapshot.relationSignatures || {};
  const targetRelations = targetSnapshot.relationSignatures || {};
  const relations = diffIdSets(
    new Set(Object.keys(baseRelations)),
    new Set(Object.keys(targetRelations)),
    (id) => baseRelations[id],
    (id) => targetRelations[id],
  );

  const totalChanges =
    nodes.added.length +
    nodes.removed.length +
    nodes.changed.length +
    relations.added.length +
    relations.removed.length +
    relations.changed.length;
  const condensed = totalChanges > MAX_DIFF_IDS;

  return {
    baseSnapshotId: baseSnapshot.id,
    targetSnapshotId: targetSnapshot.id,
    addedNodeIds: condensed ? nodes.added.slice(0, MAX_DIFF_IDS) : nodes.added,
    removedNodeIds: condensed ? nodes.removed.slice(0, MAX_DIFF_IDS) : nodes.removed,
    changedNodeIds: condensed ? nodes.changed.slice(0, MAX_DIFF_IDS) : nodes.changed,
    addedRelationIds: condensed ? relations.added.slice(0, MAX_DIFF_IDS) : relations.added,
    removedRelationIds: condensed ? relations.removed.slice(0, MAX_DIFF_IDS) : relations.removed,
    changedRelationIds: condensed ? relations.changed.slice(0, MAX_DIFF_IDS) : relations.changed,
    identical: totalChanges === 0,
    condensed,
    comparable: true,
  };
}

export type EvolutionNodeChange = "added" | "removed" | "changed" | "unchanged";

export function resolveNodeChange(
  nodeId: string,
  diff: SoftwareGraphDiffMetadata,
): EvolutionNodeChange {
  if (diff.addedNodeIds.includes(nodeId)) return "added";
  if (diff.removedNodeIds.includes(nodeId)) return "removed";
  if (diff.changedNodeIds.includes(nodeId)) return "changed";
  return "unchanged";
}

export const EVOLUTION_CHANGE_COLORS: Record<EvolutionNodeChange, string> = {
  added: "var(--color-success)",
  removed: "var(--color-destructive)",
  changed: "var(--color-warning)",
  unchanged: "var(--color-muted-foreground)",
};
