/**
 * GlossaryDrawer — alphabetisches Begriffsregister for Blueprint (Honest-Core P1-3).
 * Location: src/components/ui/GlossaryDrawer.tsx
 */

import { useMemo, useState } from "react";
import { filterGlossaryEntries } from "../../modules/blueprint/glossary.js";
import styles from "./GlossaryDrawer.module.css";

export interface GlossaryDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function GlossaryDrawer({ open, onClose }: GlossaryDrawerProps): JSX.Element | null {
  const [query, setQuery] = useState("");
  const entries = useMemo(() => filterGlossaryEntries(query), [query]);

  if (!open) return null;

  return (
    <div className={styles.backdrop} role="presentation" onClick={onClose}>
      <aside
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="glossary-drawer-title"
        data-testid="glossary-drawer"
        onClick={(event) => event.stopPropagation()}
      >
        <header className={styles.header}>
          <h2 id="glossary-drawer-title" className={styles.title}>
            Begriffsregister
          </h2>
          <button type="button" className="btn btn-sm btn-ghost" onClick={onClose}>
            Schließen
          </button>
        </header>
        <label className={styles.searchLabel}>
          <span className={styles.searchLabelText}>Suche</span>
          <input
            type="search"
            className={styles.searchInput}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Begriff filtern…"
            autoFocus
          />
        </label>
        {entries.length === 0 ? (
          <p className={styles.empty}>Kein Eintrag für diese Suche.</p>
        ) : (
          <ul className={styles.list}>
            {entries.map((entry) => (
              <li key={entry.id} className={styles.item}>
                <h3 className={styles.term}>{entry.term}</h3>
                <p className={styles.long}>{entry.long}</p>
                <p className={styles.meta}>
                  Einheit: {entry.unit} · Quelle: {entry.defaultSource}
                </p>
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  );
}
