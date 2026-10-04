/**
 * Honest-Core P0-2: runtime telemetry (CPU/RAM/Netz) is only shown when real
 * values exist in the graph. No static placeholder meters. This module is
 * intentionally empty of values; InfrastructureInspector renders the
 * `nothing-found` state when no telemetry is present.
 */

import type { PartialResourceMeterValues } from "./InfrastructureResourceMeters.js";

/** Returns real meter values from node metadata, or null when none exist. */
export function resourceMetersFromMetadata(
  metadata: Record<string, unknown> | undefined,
): PartialResourceMeterValues | null {
  if (!metadata) return null;
  const values: PartialResourceMeterValues = {};
  if (typeof metadata.cpu === "number" && Number.isFinite(metadata.cpu)) values.cpu = metadata.cpu;
  if (typeof metadata.ram === "number" && Number.isFinite(metadata.ram)) values.ram = metadata.ram;
  if (typeof metadata.networkIn === "number" && Number.isFinite(metadata.networkIn)) {
    values.networkIn = metadata.networkIn;
  }
  if (typeof metadata.networkOut === "number" && Number.isFinite(metadata.networkOut)) {
    values.networkOut = metadata.networkOut;
  }
  return Object.keys(values).length > 0 ? values : null;
}
