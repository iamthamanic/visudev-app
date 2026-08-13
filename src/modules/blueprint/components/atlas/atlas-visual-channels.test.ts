import { describe, expect, it } from "vitest";
import { ATLAS_VISUAL_CHANNELS, formatAtlasLegendEntry } from "./atlas-visual-channels.js";

describe("atlas visual channels", () => {
  it("names every map channel with a graph or decorative source", () => {
    expect(ATLAS_VISUAL_CHANNELS.map((channel) => channel.variable)).toEqual([
      "Farbe",
      "Höhe",
      "Nähe",
      "Grundfläche",
    ]);
    for (const channel of ATLAS_VISUAL_CHANNELS) {
      expect(channel.source === "graph" || channel.source === "dekorativ").toBe(true);
      expect(formatAtlasLegendEntry(channel)).toBe(
        `${channel.variable}: ${channel.meaning} — Quelle: ${channel.source}`,
      );
    }
  });

  it("marks footprint as decorative because block size is a constant", () => {
    const footprint = ATLAS_VISUAL_CHANNELS.find((channel) => channel.id === "footprint");
    expect(footprint?.source).toBe("dekorativ");
  });

  it("binds color, height, and proximity to the graph", () => {
    const graphIds = ATLAS_VISUAL_CHANNELS.filter((channel) => channel.source === "graph").map(
      (channel) => channel.id,
    );
    expect(graphIds).toEqual(["color", "height", "proximity"]);
  });
});
