/**
 * Captures and merges SoftwareGraph snapshots for evolution compare.
 */

import type {
  AnalysisOrigin,
  SoftwareGraph,
  SoftwareGraphSnapshot,
} from "../../../../shared/software-graph.types.js";

const MAX_SNAPSHOTS = 20;

export interface SnapshotCaptureOptions extends AnalysisOrigin {
  ref: string;
  label?: string;
}

export function createGraphSnapshot(
  graph: Pick<SoftwareGraph, "nodes">,
  options: SnapshotCaptureOptions,
): SoftwareGraphSnapshot {
  const snapshotId = `snapshot:${options.commitSha ?? "local"}:${options.capturedAt}`;
  return {
    id: snapshotId,
    label: options.label ?? options.ref,
    ref: options.ref,
    capturedAt: options.capturedAt,
    commitSha: options.commitSha,
    branch: options.branch,
    sourceKind: options.sourceKind,
    dirty: options.dirty,
    nodeIds: graph.nodes.map((node) => node.id),
    nodeSignatures: Object.fromEntries(
      graph.nodes.map((node) => [node.id, `${node.kind}:${node.label}`]),
    ),
  };
}

export function mergeGraphSnapshots(
  previousSnapshots: SoftwareGraphSnapshot[] | undefined,
  nextSnapshot: SoftwareGraphSnapshot,
): SoftwareGraphSnapshot[] {
  const existing = Array.isArray(previousSnapshots) ? previousSnapshots : [];
  const withoutDuplicate = existing.filter((snapshot) => snapshot.id !== nextSnapshot.id);
  return [...withoutDuplicate, nextSnapshot].slice(-MAX_SNAPSHOTS);
}

export function attachSnapshotsToGraph(
  graph: SoftwareGraph,
  options: SnapshotCaptureOptions,
  previousSnapshots?: SoftwareGraphSnapshot[],
): SoftwareGraph {
  const currentSnapshot = createGraphSnapshot(graph, options);
  return {
    ...graph,
    snapshots: mergeGraphSnapshots(previousSnapshots, currentSnapshot),
  };
}
