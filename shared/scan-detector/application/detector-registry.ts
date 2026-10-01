/**
 * In-memory detector registry — capability + priority selection.
 * Location: shared/scan-detector/application/detector-registry.ts
 */

import type { DetectorRegistry, ScanDetector } from "../domain/detector.js";

export class InMemoryDetectorRegistry implements DetectorRegistry {
  private readonly detectors = new Map<string, ScanDetector>();

  register(detector: ScanDetector): void {
    if (this.detectors.has(detector.id)) {
      throw new Error(`Duplicate detector id: ${detector.id}`);
    }
    this.detectors.set(detector.id, detector);
  }

  list(): readonly ScanDetector[] {
    return [...this.detectors.values()].sort(compareDetectors);
  }

  select(capabilityIds: readonly string[]): ScanDetector[] {
    const all = this.list();
    if (capabilityIds.length === 0) return [...all];
    const wanted = new Set(capabilityIds);
    return all.filter((detector) => wanted.has(detector.capability.id));
  }
}

function compareDetectors(left: ScanDetector, right: ScanDetector): number {
  if (left.priority !== right.priority) return left.priority - right.priority;
  return left.id.localeCompare(right.id);
}
