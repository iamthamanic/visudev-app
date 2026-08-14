/**
 * EvolutionBranchCompare — branch selector + real git diff projection (AUF-2).
 * Location: src/modules/blueprint/components/evolution/EvolutionBranchCompare.tsx
 */

import { useEffect, useMemo, useState } from "react";
import { getVisuDevClient, isLocalVisuDevMode } from "../../../../lib/visudev-api";
import type { GitBranchDiff, GitSummary, SoftwareGraphNode } from "../../types";
import { findNodeIdsByFilePath, HINT_NO_NODE } from "../../selection.js";
import styles from "../../styles/EvolutionView.module.css";

interface EvolutionBranchCompareProps {
  projectId: string | undefined;
  gitSummary: GitSummary | null;
  graphNodes?: readonly SoftwareGraphNode[];
}

function emptyIdenticalDiff(base: string, head: string): GitBranchDiff {
  return {
    base,
    head,
    files: [],
    addedLines: 0,
    removedLines: 0,
    changedFiles: 0,
    identical: true,
    truncated: false,
  };
}

export function EvolutionBranchCompare({
  projectId,
  gitSummary,
  graphNodes = [],
}: EvolutionBranchCompareProps): JSX.Element {
  const [base, setBase] = useState<string>("");
  const [head, setHead] = useState<string>("");
  const [diff, setDiff] = useState<GitBranchDiff | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const branches = useMemo(() => gitSummary?.branches ?? [], [gitSummary?.branches]);
  const localMode = isLocalVisuDevMode();
  const nodeById = useMemo(() => new Map(graphNodes.map((node) => [node.id, node])), [graphNodes]);

  useEffect(() => {
    if (branches.length === 0) return;
    if (!base) setBase(branches[0].name);
    if (!head && branches.length > 1) setHead(branches[1].name);
  }, [branches, base, head]);

  useEffect(() => {
    if (!projectId || !localMode || !base || !head) {
      setDiff(null);
      setError(null);
      return;
    }

    if (base === head) {
      setDiff(emptyIdenticalDiff(base, head));
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void getVisuDevClient()
      .getGitBranchDiff(projectId, base, head)
      .then((result) => {
        if (!cancelled) {
          setDiff(result);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Branch-Vergleich fehlgeschlagen");
          setDiff(null);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [projectId, localMode, base, head]);

  if (!localMode) {
    return (
      <div className={styles.placeholderPanel} data-testid="evolution-branch-compare">
        <h2 className={styles.placeholderTitle}>Branch Compare</h2>
        <p className={styles.emptyControls}>Branch-Vergleich ist nur im lokalen Modus verfügbar.</p>
      </div>
    );
  }

  if (!gitSummary || branches.length < 2) {
    return (
      <div className={styles.placeholderPanel} data-testid="evolution-branch-compare">
        <h2 className={styles.placeholderTitle}>Branch Compare</h2>
        <p className={styles.emptyControls}>
          Mindestens zwei Branches im Repository nötig. Aktuell: {branches.length} Branch(es).
        </p>
      </div>
    );
  }

  return (
    <div className={styles.branchCompare} data-testid="evolution-branch-compare">
      <div className={styles.branchCompareControls}>
        <label className={styles.fieldLabel}>
          Basis
          <select
            className={styles.select}
            value={base}
            onChange={(event) => setBase(event.target.value)}
          >
            {branches.map((branch) => (
              <option key={branch.name} value={branch.name}>
                {branch.name}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.fieldLabel}>
          Ziel
          <select
            className={styles.select}
            value={head}
            onChange={(event) => setHead(event.target.value)}
          >
            {branches.map((branch) => (
              <option key={branch.name} value={branch.name}>
                {branch.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {loading ? <p className={styles.hint}>Diff wird geladen…</p> : null}
      {error ? (
        <p className={styles.hint} role="alert">
          {error}
        </p>
      ) : null}

      {!loading && !error && diff ? (
        diff.identical ? (
          <p className={styles.emptyControls} data-testid="branch-diff-empty">
            Keine Unterschiede zwischen {base} und {head}.
          </p>
        ) : (
          <div className={styles.branchDiffResult} data-testid="branch-diff-result">
            <p className={styles.hint}>
              {diff.changedFiles} Datei(en) geändert · +{diff.addedLines} −{diff.removedLines}
              {diff.truncated ? " · großer Diff (gekürzt)" : ""}
            </p>
            <ul className={styles.branchDiffList}>
              {diff.files.map((file) => {
                const relatedIds = findNodeIdsByFilePath(graphNodes, file.filePath);
                const relatedLabels = relatedIds
                  .map((id) => nodeById.get(id)?.label)
                  .filter((label): label is string => Boolean(label));
                return (
                  <li key={file.filePath} className={styles.branchDiffItem}>
                    <span className={styles.branchDiffPath}>{file.filePath}</span>
                    <span className={styles.branchDiffStats}>
                      +{file.added} −{file.removed}
                    </span>
                    <span className={styles.branchDiffNodes} data-testid="branch-diff-nodes">
                      {relatedLabels.length > 0 ? relatedLabels.join(", ") : HINT_NO_NODE}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )
      ) : null}
    </div>
  );
}
