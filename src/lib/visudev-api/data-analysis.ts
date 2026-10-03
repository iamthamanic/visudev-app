/**
 * Data analysis facade — product slices import here, not shared/scan-detector (SDE-15).
 * Location: src/lib/visudev-api/data-analysis.ts
 */

export {
  DEFAULT_DATA_ANALYSIS_MODE,
  parseDataAnalysisMode,
  resolveDataAnalysis,
} from "../../../shared/scan-detector/index.js";
export type {
  DataAnalysisMode,
  DataAnalysisSource,
  LegacyErdSnapshot,
  ResolveDataAnalysisResult,
} from "../../../shared/scan-detector/index.js";
