/**
 * EvolutionCommitDiff — real git commit-to-commit file diff (PR-20).
 * Location: src/modules/blueprint/components/evolution/EvolutionCommitDiff.tsx
 */

import { useEffect, useMemo, useState } from "react";
import { getVisuDevClient, isLocalVisuDevMode } from "../../../../lib/visudev-api";
import type { GitBranchDiff, GitSummary } from "../../types";
import { formatCommitSha } from "./evolution-display.js";
import styles from "../../styles/EvolutionView.module.css";

interface EvolutionCommitDiffProps {
  projectId: string | undefined;
  gitSummary: GitSummary | null;
  /** Prefill from timeline selection when available. */
  preferredHeadSha?: string | null;
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

export function EvolutionCommitDiff({
  projectId,
  gitSummary,
  preferredHeadSha = null,
}: EvolutionCommitDiffProps): JSX.Element {
  const commits = useMemo(() => gitSummary?.commits ?? [], [gitSummary?.commits]);
  const [base, setBase] = useState("");
  const [head, setHead] = useState("");
  const [diff, setDiff] = useState<GitBranchDiff | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const localMode = isLocalVisuDevMode();

  useEffect(() => {
    if (commits.length === 0) return;
    const headSha =
      (preferredHeadSha && commits.some((commit) => commit.sha === preferredHeadSha)
        ? preferredHeadSha
        : null) ||
      commits[0]?.sha ||
      "";
    const baseSha =
      commits.find((commit) => commit.sha !== headSha)?.sha ||
      commits[1]?.sha ||
      commits[0]?.sha ||
      "";
    if (!head) setHead(headSha);
    if (!base) setBase(baseSha);
  }, [commits, preferredHeadSha, base, head]);

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
          setError(err instanceof Error ? err.message : "Commit-Diff fehlgeschlagen");
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
      <div className={styles.placeholderPanel} data-testid="evolution-commit-diff">
        <h2 className={styles.placeholderTitle}>Commit Diff</h2>
        <p className={styles.emptyControls}>Commit-Diff ist nur im lokalen Modus verfügbar.</p>
      </div>
    );
  }

  if (!gitSummary || commits.length < 2) {
    return (
      <div className={styles.placeholderPanel} data-testid="evolution-commit-diff">
        <h2 className={styles.placeholderTitle}>Commit Diff</h2>
        <p className={styles.emptyControls}>
          Mindestens zwei echte Git-Commits sind nötig. Es werden keine synthetischen SHAs erzeugt.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.placeholderPanel} data-testid="evolution-commit-diff">
      <h2 className={styles.placeholderTitle}>Commit Diff</h2>
      <div className={styles.branchCompareControls}>
        <label className={styles.fieldLabel}>
          Basis-Commit
          <select
            className={styles.select}
            value={base}
            onChange={(event) => setBase(event.target.value)}
            data-testid="evolution-commit-diff-base"
          >
            {commits.map((commit) => (
              <option key={`base-${commit.sha}`} value={commit.sha}>
                {formatCommitSha(commit.sha)} · {commit.subject.slice(0, 48)}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.fieldLabel}>
          Ziel-Commit
          <select
            className={styles.select}
            value={head}
            onChange={(event) => setHead(event.target.value)}
            data-testid="evolution-commit-diff-head"
          >
            {commits.map((commit) => (
              <option key={`head-${commit.sha}`} value={commit.sha}>
                {formatCommitSha(commit.sha)} · {commit.subject.slice(0, 48)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {loading ? <p className={styles.loading}>Commit-Diff wird geladen…</p> : null}
      {error ? (
        <p className={styles.hint} data-testid="evolution-commit-diff-error">
          {error}
        </p>
      ) : null}

      {diff && !loading ? (
        <div data-testid="evolution-commit-diff-result">
          <p className={styles.hint}>
            {diff.identical
              ? "Keine Dateiunterschiede zwischen den Commits."
              : `${diff.changedFiles} Dateien · +${diff.addedLines} / −${diff.removedLines}${
                  diff.truncated ? " (gekürzt)" : ""
                }`}
          </p>
          <ul className={styles.branchDiffList} aria-label="Commit-Diff Dateien">
            {diff.files.map((file) => (
              <li key={file.filePath} className={styles.branchDiffItem}>
                <span>{file.filePath}</span>
                <span>
                  +{file.added} / −{file.removed}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
