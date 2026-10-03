/**
 * AppFlow analysis facade — product slices import here, not shared/scan-detector (SDE-15).
 * Location: src/lib/visudev-api/appflow-analysis.ts
 */

export {
  DEFAULT_APPFLOW_ANALYSIS_MODE,
  parseAppflowAnalysisMode,
  resolveAppflowAnalysis,
} from "../../../shared/scan-detector/index.js";
export type {
  AppflowAnalysisMode,
  AppflowAnalysisSource,
  AppflowProjectionEdge,
  ResolveAppflowAnalysisResult,
  UiKnowledgeStatus,
} from "../../../shared/scan-detector/index.js";
