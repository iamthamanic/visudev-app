/**
 * Derives neon glow-plate geometry under Atlas city districts (pure helper).
 * Location: src/modules/blueprint/components/atlas/
 */

import type { AtlasClusterCategory } from "./atlas-cluster-theme.js";
import type { CityBlock } from "./build-city-blocks.js";

export interface DistrictGlowPlate {
  key: string;
  category: AtlasClusterCategory;
  x: number;
  z: number;
  width: number;
  depth: number;
  color: string;
}

function boundsOf(values: number[]): { min: number; max: number } {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const value of values) {
    if (value < min) min = value;
    if (value > max) max = value;
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return { min: 0, max: 0 };
  }
  return { min, max };
}

export function buildDistrictGlowPlates(
  blocks: CityBlock[],
  palette: Record<AtlasClusterCategory, string>,
  fallbackColor: string,
): DistrictGlowPlate[] {
  const byDistrict = new Map<string, CityBlock[]>();
  for (const block of blocks) {
    const key = block.districtLabel;
    const list = byDistrict.get(key) ?? [];
    list.push(block);
    byDistrict.set(key, list);
  }

  const plates: DistrictGlowPlate[] = [];
  for (const [label, districtBlocks] of byDistrict) {
    if (districtBlocks.length === 0) continue;
    const xBounds = boundsOf(districtBlocks.map((b) => b.x));
    const zBounds = boundsOf(districtBlocks.map((b) => b.z));
    const category = districtBlocks[0].clusterCategory;
    const color = palette[category] || palette.default || fallbackColor;
    if (!color) continue;
    plates.push({
      // Stable unique key — district labels alone collide across categories.
      key: `district:${category}:${label}:${plates.length}`,
      category,
      x: (xBounds.min + xBounds.max) / 2,
      z: (zBounds.min + zBounds.max) / 2,
      width: Math.max(3.2, xBounds.max - xBounds.min + 3.2),
      depth: Math.max(3.2, zBounds.max - zBounds.min + 3.2),
      color,
    });
  }
  return plates;
}
