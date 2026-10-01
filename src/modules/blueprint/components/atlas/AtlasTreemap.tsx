/**
 * Treemap from SoftwareGraph module/file sizes — honest empty when thin.
 * Location: src/modules/blueprint/components/atlas/AtlasTreemap.tsx
 */

import type { SoftwareGraph } from "../../types";
import { projectTreemapCells } from "./atlas-treemap-projection.js";

export interface AtlasTreemapProps {
  graph: SoftwareGraph | null | undefined;
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
    <div data-testid="atlas-treemap" style={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
      {cells.map((cell) => {
        const pct = Math.max(4, Math.round((cell.weight / total) * 100));
        return (
          <div
            key={cell.id}
            title={`${cell.label} (${cell.weight})`}
            style={{
              flex: `1 1 ${pct}%`,
              minWidth: 48,
              minHeight: 36,
              padding: "0.35rem",
              background: "color-mix(in srgb, var(--color-primary, #2563eb) 18%, transparent)",
              border: "1px solid color-mix(in srgb, var(--color-primary, #2563eb) 35%, transparent)",
              fontSize: 11,
              overflow: "hidden",
            }}
          >
            {cell.label}
          </div>
        );
      })}
    </div>
  );
}
