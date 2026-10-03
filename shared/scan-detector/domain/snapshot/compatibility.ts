/**
 * Snapshot version compatibility rules (SDE-13).
 * Incompatible versions must never be silently reused.
 * Location: shared/scan-detector/domain/snapshot/compatibility.ts
 */

import type { ScanVersionManifest } from "../../types.js";

function majorOf(version: string): string {
  const major = version.trim().split(".")[0] ?? "";
  return major.length > 0 ? major : version.trim();
}

function modelMap(manifest: ScanVersionManifest): Record<string, string> {
  const models = manifest.modelVersions;
  const out: Record<string, string> = {};
  if (models.softwareGraph) out.softwareGraph = models.softwareGraph;
  if (models.semanticSystemModel) out.semanticSystemModel = models.semanticSystemModel;
  if (models.uiInteractionGraph) out.uiInteractionGraph = models.uiInteractionGraph;
  if (models.dataGraph) out.dataGraph = models.dataGraph;
  return out;
}

/**
 * True when a stored snapshot may be reused for a requested scan.
 * Rules:
 * - Engine major versions must match
 * - Every requested detector version must equal the stored version for that id
 * - Every requested model version key must equal the stored value
 */
export function isSnapshotCompatible(
  stored: ScanVersionManifest,
  requested: ScanVersionManifest,
): boolean {
  if (!stored.engineVersion || !requested.engineVersion) return false;
  if (majorOf(stored.engineVersion) !== majorOf(requested.engineVersion)) return false;

  for (const [detectorId, version] of Object.entries(requested.detectorVersions)) {
    if (stored.detectorVersions[detectorId] !== version) return false;
  }

  const storedModels = modelMap(stored);
  const requestedModels = modelMap(requested);
  for (const [modelId, version] of Object.entries(requestedModels)) {
    if (storedModels[modelId] !== version) return false;
  }

  return true;
}

/**
 * Per-detector compatibility: detector may reuse cached facts only when its
 * own version matches and engine major + relevant models are compatible.
 */
export function isDetectorVersionCompatible(
  stored: ScanVersionManifest,
  requested: ScanVersionManifest,
  detectorId: string,
): boolean {
  if (!isSnapshotCompatible(stored, { ...requested, detectorVersions: {} })) {
    // Engine / models incompatible — never reuse any detector slice
    return false;
  }
  const requestedVersion = requested.detectorVersions[detectorId];
  if (!requestedVersion) return false;
  return stored.detectorVersions[detectorId] === requestedVersion;
}
