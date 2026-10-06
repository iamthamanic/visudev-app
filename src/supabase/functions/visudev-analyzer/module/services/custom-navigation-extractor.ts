/**
 * Analyzer adapter: custom navigation → Screen[] for AppFlow pipeline (PU-05).
 * Delegates detection to shared extractCustomNavigation (no project-specific rules).
 * Location: module/services/custom-navigation-extractor.ts
 */
import type { FileContent, Screen } from "../dto/index.ts";
import { extractCustomNavigation } from "@visudev/shared/scan-detector/application/extract-custom-navigation.ts";
import type { CustomNavigationCoverage } from "@visudev/shared/scan-detector/application/extract-custom-navigation.ts";
import { customNavigationToLegacyScreens } from "@visudev/shared/scan-detector/application/merge-custom-navigation-into-ui-graph.ts";

export type { CustomNavigationCoverage };

export class CustomNavigationExtractor {
  public extract(
    files: FileContent[],
  ): { screens: Screen[]; coverage: CustomNavigationCoverage } {
    const result = extractCustomNavigation(files);
    const legacy = customNavigationToLegacyScreens(result);
    const screens: Screen[] = legacy.map((s) => ({
      id: s.id,
      name: s.name,
      path: s.path,
      filePath: s.filePath ?? "unknown",
      type: s.type ?? "screen",
      flows: [],
      navigatesTo: s.navigatesTo ?? [],
      framework: s.framework ?? "custom-nav",
      knowledgeStatus: s.knowledgeStatus,
      evidenceLine: s.evidenceLine,
      confidence: s.confidence,
    }));
    return { screens, coverage: result.coverage };
  }
}
