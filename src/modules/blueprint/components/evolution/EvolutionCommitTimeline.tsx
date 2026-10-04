/**
 * EvolutionCommitTimeline — commit dots with short SHA + subject for Wave 5 density.
 */

import type { GitSummaryCommit } from "../../types";
import { formatCommitSha, displayText } from "./evolution-display.js";
import styles from "../../styles/EvolutionView.module.css";

export interface EvolutionCommitTimelineProps {
  commits: GitSummaryCommit[];
  selectedCommitSha: string | null;
  onSelectCommit: (sha: string) => void;
}

export function EvolutionCommitTimeline({
  commits,
  selectedCommitSha,
  onSelectCommit,
}: EvolutionCommitTimelineProps): JSX.Element {
  if (commits.length === 0) {
    return (
      <div
        className={styles.commitTimeline}
        aria-label="Commit-Timeline"
        data-testid="evolution-timeline"
      >
        <p className={styles.emptyControls} data-testid="evolution-git-nothing-found">
          Keine Git-Historie gefunden — semantischer Verlauf nicht verfügbar.
        </p>
      </div>
    );
  }

  return (
    <div
      className={styles.commitTimeline}
      aria-label="Commit-Timeline"
      data-testid="evolution-timeline"
    >
      <ul className={styles.commitTimelineList}>
        {commits.map((commit, index) => {
          const isSelected = commit.sha === selectedCommitSha;
          return (
            <li key={`${commit.sha}:${index}`} className={styles.commitTimelineItem}>
              {index > 0 ? (
                <span className={styles.commitTimelineConnector} aria-hidden="true" />
              ) : null}
              <button
                type="button"
                className={`${styles.commitTimelineButton} ${isSelected ? styles.commitTimelineButtonActive : ""}`}
                aria-pressed={isSelected}
                title={displayText(commit.subject)}
                data-testid="evolution-timeline-commit"
                onClick={() => onSelectCommit(commit.sha)}
              >
                <span className={styles.commitTimelineDot} aria-hidden="true" />
                <span className={styles.commitTimelineSha}>{formatCommitSha(commit.sha)}</span>
                <span className={styles.commitTimelineSubject}>{displayText(commit.subject)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
