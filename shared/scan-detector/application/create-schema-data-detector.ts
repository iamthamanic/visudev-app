/**
 * Schema/Data detector — adapts ERD introspection into DataGraph facts (SDE-12).
 * Location: shared/scan-detector/application/create-schema-data-detector.ts
 */

import type { LegacyErdSnapshot } from "../../data-graph.types.js";
import type { DetectorCapability } from "../types.js";
import type { DetectorRunContext, DetectorRunResult, ScanDetector } from "../domain/detector.js";
import { adaptErdToDataGraph } from "./adapt-erd-to-data-graph.js";
import { dataGraphToScanFacts } from "./data-graph-to-scan-facts.js";

export const SCHEMA_DATA_DETECTOR_ID = "schema-data-detector-v1";

export const SCHEMA_DATA_CAPABILITY: DetectorCapability = {
  id: "schema-data-graph",
  label: "Schema DataGraph",
  family: "schema-introspect",
  version: "1.0.0",
  supports: ["postgres", "sqlite", "prisma"],
};

export interface SchemaDataDetectorHost {
  getErdSnapshot(context: DetectorRunContext): LegacyErdSnapshot | Promise<LegacyErdSnapshot>;
}

export function createSchemaDataDetector(host: SchemaDataDetectorHost): ScanDetector {
  return {
    id: SCHEMA_DATA_DETECTOR_ID,
    priority: 25,
    capability: SCHEMA_DATA_CAPABILITY,
    async run(context: DetectorRunContext): Promise<DetectorRunResult> {
      try {
        const erd = await host.getErdSnapshot(context);
        const graph = adaptErdToDataGraph({
          erd: { ...erd, projectId: erd.projectId || context.projectId },
          detectorId: SCHEMA_DATA_DETECTOR_ID,
        });
        const bundle = dataGraphToScanFacts(graph, SCHEMA_DATA_DETECTOR_ID);
        const maxFacts = context.budget.maxFacts;
        const facts =
          typeof maxFacts === "number" && bundle.facts.length > maxFacts
            ? bundle.facts.slice(0, maxFacts)
            : bundle.facts;
        return {
          detectorId: SCHEMA_DATA_DETECTOR_ID,
          status: facts.length < bundle.facts.length ? "partial" : "success",
          facts,
          evidence: bundle.evidence,
          exercisedCapabilityIds: [SCHEMA_DATA_CAPABILITY.id],
        };
      } catch (error) {
        return {
          detectorId: SCHEMA_DATA_DETECTOR_ID,
          status: "failed",
          facts: [],
          evidence: [],
          errorMessage: error instanceof Error ? error.message : "schema data detector failed",
        };
      }
    },
  };
}
