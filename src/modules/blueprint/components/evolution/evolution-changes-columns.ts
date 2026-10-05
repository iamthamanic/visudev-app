/**
 * Pure column model for Evolution changes grid.
 * Architecture columns use snapshot/semantic diff ids — not git working-tree as a substitute (RVP-11).
 */

import type { GitSummary, SoftwareGraphDiffMetadata } from "../../types";

export interface EvolutionChangesColumn {
  id: string;
  label: string;
  count: number;
  paths: string[];
}

function shortIds(ids: readonly string[] | undefined, limit: number): string[] {
  if (!ids || ids.length === 0) return [];
  return ids.slice(0, limit).map((id) => {
    const parts = id.split(":");
    return parts[parts.length - 1] || id;
  });
}

export function buildEvolutionChangesColumns(
  diff: SoftwareGraphDiffMetadata | null,
  gitSummary: GitSummary | null,
): EvolutionChangesColumn[] {
  const dependencyPaths = (gitSummary?.workingTree.modified ?? [])
    .filter((path) => /package|lock|dependency|pom|gradle/i.test(path))
    .slice(0, 3);

  return [
    {
      id: "added",
      label: "Neue Module",
      count: diff?.addedNodeIds.length ?? 0,
      paths: shortIds(diff?.addedNodeIds, 4),
    },
    {
      id: "changed",
      label: "Geänderte Module",
      count: diff?.changedNodeIds.length ?? 0,
      paths: shortIds(diff?.changedNodeIds, 6),
    },
    {
      id: "removed",
      label: "Entfernte Module",
      count: diff?.removedNodeIds.length ?? 0,
      paths: shortIds(diff?.removedNodeIds, 3),
    },
    {
      id: "relations",
      label: "Geänderte Relationen",
      count:
        (diff?.addedRelationIds?.length ?? 0) +
        (diff?.changedRelationIds?.length ?? 0) +
        (diff?.removedRelationIds?.length ?? 0),
      paths: shortIds(
        [
          ...(diff?.addedRelationIds ?? []),
          ...(diff?.changedRelationIds ?? []),
          ...(diff?.removedRelationIds ?? []),
        ],
        4,
      ),
    },
    {
      id: "deps",
      label: "Top Dependency-Änderungen",
      count: dependencyPaths.length,
      paths: dependencyPaths,
    },
  ];
}
