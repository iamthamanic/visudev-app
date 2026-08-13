/**
 * Atlas visual-channel inventory (Honest-Core P1-6).
 * Location: src/modules/blueprint/components/atlas/atlas-visual-channels.ts
 *
 * Documents what AtlasCityScene / buildCityBlocks actually encode today.
 * Height is kind-based, not fan-in or LOC — do not claim those metrics.
 */

export type AtlasVisualSource = "graph" | "dekorativ";

export interface AtlasVisualChannel {
  id: string;
  variable: string;
  meaning: string;
  source: AtlasVisualSource;
}

export const ATLAS_VISUAL_CHANNELS: readonly AtlasVisualChannel[] = [
  {
    id: "color",
    variable: "Farbe",
    meaning: "Cluster-Rolle",
    source: "graph",
  },
  {
    id: "height",
    variable: "Höhe",
    meaning: "Knotentyp",
    source: "graph",
  },
  {
    id: "proximity",
    variable: "Nähe",
    meaning: "Distrikt (Graph-Gruppe)",
    source: "graph",
  },
  {
    id: "footprint",
    variable: "Grundfläche",
    meaning: "festes Rastermaß",
    source: "dekorativ",
  },
];

export function formatAtlasLegendEntry(channel: AtlasVisualChannel): string {
  return `${channel.variable}: ${channel.meaning} — Quelle: ${channel.source}`;
}
