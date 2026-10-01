/**
 * One-shot helper: write expected-semantic-baseline.json for golden-repo.
 * Usage: npx tsx scripts/golden-set/write-semantic-baseline.mjs
 */

import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { analyzeLocalBlueprint } from "../../preview-runner/lib/blueprint-local.js";
import { extractSemanticBaseline } from "../../shared/migration-baseline.ts";

const fixturePath = fileURLToPath(new URL("../../tests/fixtures/golden-repo/", import.meta.url));
const outPath = fileURLToPath(
  new URL("../../tests/fixtures/golden-repo/expected-semantic-baseline.json", import.meta.url),
);

const result = await analyzeLocalBlueprint({
  localPath: fixturePath,
  projectId: "golden-set",
});
const blueprint = result.blueprint;
const fingerprint = extractSemanticBaseline({
  projectId: "golden-set",
  enrichment: "off",
  allowedUnknownKeys: ["partial-scan", "inferred-route"],
  graph: blueprint.graph,
  routes: blueprint.routes,
  screens: [],
  flows: [],
});

await writeFile(outPath, `${JSON.stringify(fingerprint, null, 2)}\n`, "utf8");
console.log(`wrote ${outPath}`);
console.log(
  JSON.stringify(
    {
      routes: fingerprint.blueprint.routeIds.length,
      tables: fingerprint.data.tableIds,
      nodeKinds: fingerprint.blueprint.nodeKindCounts,
      domains: fingerprint.semantic.businessDomainLabels,
    },
    null,
    2,
  ),
);
