/**
 * Layer navigation for Dependencies: Impact (default) → Technik → Dateien.
 * Location: src/modules/blueprint/components/dependencies/DependenciesLayerNav.tsx
 */

import styles from "../../styles/DependenciesView.module.css";

export type DependenciesLayer = "impact" | "technik" | "files";

const LAYERS: Array<{ id: DependenciesLayer; label: string }> = [
  { id: "impact", label: "Impact" },
  { id: "technik", label: "Technik" },
  { id: "files", label: "Dateien" },
];

export interface DependenciesLayerNavProps {
  layer: DependenciesLayer;
  onChange: (layer: DependenciesLayer) => void;
}

export function DependenciesLayerNav({ layer, onChange }: DependenciesLayerNavProps): JSX.Element {
  const currentLabel = LAYERS.find((entry) => entry.id === layer)?.label ?? layer;
  return (
    <nav
      aria-label="Dependencies-Ebenen"
      className={styles.layerNav}
      data-testid="dependencies-layer-nav"
    >
      <label className={styles.layerNavLabel}>
        <span>Ebene</span>
        <select
          className={styles.layerNavSelect}
          value={layer}
          aria-label="Dependencies-Ebene wählen"
          data-testid="dependencies-layer-select"
          onChange={(event) => onChange(event.target.value as DependenciesLayer)}
        >
          {LAYERS.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.label}
            </option>
          ))}
        </select>
        <span aria-live="polite" data-testid="dependencies-layer-current">
          {currentLabel}
        </span>
      </label>
      <div hidden>
        {LAYERS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            data-testid={`dependencies-layer-${entry.id}`}
            onClick={() => onChange(entry.id)}
          >
            {entry.label}
          </button>
        ))}
      </div>
    </nav>
  );
}
