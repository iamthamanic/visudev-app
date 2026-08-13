/**
 * Honest-Core P0-2: runtime telemetry (CPU/RAM/Netz) is only shown when real
 * values exist in the graph. No static placeholder meters. This module is
 * intentionally empty of values; InfrastructureInspector renders the
 * `nothing-found` state when no telemetry is present.
 */

import type { ResourceMeterValues } from "./InfrastructureResourceMeters.js";

/** Returns real meter values from node metadata, or null when none exist. */
export function resourceMetersFromMetadata(
  metadata: Record<string, unknown> | undefined,
): ResourceMeterValues | null {
  if (!metadata) return null;
  const cpu = metadata.cpu;
  const ram = metadata.ram;
  const networkIn = metadata.networkIn;
  const networkOut = metadata.networkOut;
  const values: Partial<ResourceMeterValues> = {};
  if (typeof cpu === "number" && Number.isFinite(cpu)) values.cpu = cpu;
  if (typeof ram === "number" && Number.isFinite(ram)) values.ram = ram;
  if (typeof networkIn === "number" && Number.isFinite(networkIn)) values.networkIn = networkIn;
  if (typeof networkOut === "number" && Number.isFinite(networkOut)) values.networkOut = networkOut;
  return Object.keys(values).length > 0 ? (values as ResourceMeterValues) : null;
}
