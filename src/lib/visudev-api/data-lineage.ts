/**
 * Data lineage facade — product slices import here, not shared/scan-detector (PR-22).
 * Location: src/lib/visudev-api/data-lineage.ts
 */

export {
  adaptLegacyScreensToUiGraph,
  buildDataLineage,
  softwareGraphToScanFacts,
} from "../../../shared/scan-detector/index.js";
export type {
  BuildDataLineageInput,
  DataLineageGraph,
  DataLineageLayer,
  DataLineagePath,
  LineageEntityRef,
  LineageHop,
  LineageHopEvidence,
  LineagePathStatus,
} from "../../../shared/scan-detector/index.js";
