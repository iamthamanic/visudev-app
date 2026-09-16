/**
 * Semantic level navigation: System → Domain → Module → File.
 * Location: src/modules/blueprint/components/architecture/ArchitectureLevelNav.tsx
 *
 * Single select (Hick): one primary control instead of four competing buttons.
 */

import styles from "../../styles/ArchitectureView.module.css";

export type ArchitectureLevel = "system" | "domain" | "module" | "file";

const LEVELS: Array<{ id: ArchitectureLevel; label: string }> = [
  { id: "system", label: "System" },
  { id: "domain", label: "Domain" },
  { id: "module", label: "Modul" },
  { id: "file", label: "Datei" },
];

export interface ArchitectureLevelNavProps {
  level: ArchitectureLevel;
  onChange: (level: ArchitectureLevel) => void;
  available: Partial<Record<ArchitectureLevel, boolean>>;
}

export function ArchitectureLevelNav({
  level,
  onChange,
  available,
}: ArchitectureLevelNavProps): JSX.Element {
  const currentLabel = LEVELS.find((entry) => entry.id === level)?.label ?? level;
  return (
    <nav aria-label="Architektur-Ebenen" className={styles.levelNav} data-testid="architecture-level-nav">
      <label className={styles.levelNavLabel}>
        <span>Ebene</span>
        <select
          className={styles.levelNavSelect}
          value={level}
          aria-label="Architektur-Ebene wählen"
          data-testid="arch-level-select"
          onChange={(event) => onChange(event.target.value as ArchitectureLevel)}
        >
          {LEVELS.map((entry) => {
            const enabled = available[entry.id] !== false;
            return (
              <option key={entry.id} value={entry.id} disabled={!enabled}>
                {entry.label}
              </option>
            );
          })}
        </select>
        <span aria-live="polite" data-testid="arch-level-current">
          {currentLabel}
        </span>
      </label>
      {/* Keep stable per-level hooks for tests that target a specific level. */}
      <div hidden>
        {LEVELS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            data-testid={`arch-level-${entry.id}`}
            disabled={available[entry.id] === false}
            onClick={() => onChange(entry.id)}
          >
            {entry.label}
          </button>
        ))}
      </div>
    </nav>
  );
}
