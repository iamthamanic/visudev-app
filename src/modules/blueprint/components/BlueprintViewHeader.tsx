/**
 * View title header for Blueprint shell (German labels + breadcrumb).
 * Location: src/modules/blueprint/components/
 */

import { getBlueprintViewLabel, type BlueprintShellViewId } from "../blueprint-view-config.js";
import styles from "../styles/BlueprintViewHeader.module.css";

interface BlueprintViewHeaderProps {
  activeView: BlueprintShellViewId;
  projectName?: string;
  branchLabel?: string;
  onOpenGlossary?: () => void;
}

export function BlueprintViewHeader({
  activeView,
  projectName,
  branchLabel,
  onOpenGlossary,
}: BlueprintViewHeaderProps): JSX.Element {
  const viewLabel = getBlueprintViewLabel(activeView);

  return (
    <header className={styles.root}>
      <div className={styles.copy}>
        <p className={styles.kicker}>Blueprint</p>
        <h2 className={styles.title}>{viewLabel}</h2>
        {projectName ? (
          <p className={styles.breadcrumb}>
            {projectName}
            {branchLabel ? ` › ${branchLabel}` : null}
          </p>
        ) : null}
      </div>
      {onOpenGlossary ? (
        <button
          type="button"
          className={`btn btn-sm btn-ghost ${styles.glossaryButton}`}
          onClick={onOpenGlossary}
          aria-label="Begriffsregister öffnen"
        >
          ?
        </button>
      ) : null}
    </header>
  );
}
