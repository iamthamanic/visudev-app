/**
 * Treemap from SoftwareGraph module/file sizes — honest empty when thin.
 * Location: src/modules/blueprint/components/atlas/AtlasTreemap.tsx
 */

import type { SoftwareGraph } from "../../types";
import { projectTreemapCells } from "./atlas-treemap-projection.js";
import styles from "../../styles/AtlasTreemap.module.css";

export interface AtlasTreemapProps {
  graph: SoftwareGraph | null | undefined;
}

function weightTier(weight: number, total: number): "sm" | "md" | "lg" {
  if (total <= 0) return "sm";
  const ratio = weight / total;
  if (ratio >= 0.25) return "lg";
  if (ratio >= 0.1) return "md";
  return "sm";
}

export function AtlasTreemap({ graph }: AtlasTreemapProps): JSX.Element {
  const cells = projectTreemapCells(graph);
  if (cells.length === 0) {
    return (
      <p data-testid="atlas-treemap-empty" role="status">
        Treemap erst verfügbar, wenn genug Module/Domains im Graph vorliegen.
      </p>
    );
  }
  const total = cells.reduce((sum, cell) => sum + cell.weight, 0);
  return (
    <div data-testid="atlas-treemap" className={styles.root}>
      {cells.map((cell) => (
        <div
          key={cell.id}
          title={`${cell.label} (${cell.weight})`}
          className={styles.cell}
          data-weight-tier={weightTier(cell.weight, total)}
        >
          {cell.label}
        </div>
      ))}
    </div>
  );
}
