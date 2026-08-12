import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { analyzeLocalBlueprint } from "../../preview-runner/lib/blueprint-local.js";

const METRIC_NAMES = ["nodes", "edges", "routes", "tables", "files", "duplicateNodeIds"];
const fixturePath = fileURLToPath(new URL("../../tests/fixtures/golden-repo/", import.meta.url));
const expectedMetricsPath = new URL(
  "../../tests/fixtures/golden-repo/expected-metrics.json",
  import.meta.url,
);

function collectMetrics(result) {
  const graph = result.blueprint.graph;
  const nodes = Array.isArray(graph?.nodes) ? graph.nodes : [];

  return {
    nodes: nodes.length,
    edges: Array.isArray(graph?.edges) ? graph.edges.length : 0,
    routes: Array.isArray(result.blueprint.routes) ? result.blueprint.routes.length : 0,
    tables: nodes.filter((node) => node.kind === "table").length,
    files: Number.isInteger(result.blueprint.filesAnalyzed) ? result.blueprint.filesAnalyzed : 0,
    duplicateNodeIds: nodes.filter((node) => node.id.includes("~")).length,
  };
}

function formatMetrics(metrics) {
  return METRIC_NAMES.map((name) => `${name}=${metrics[name]}`).join(" ");
}

const reportOnly = process.argv.slice(2).includes("--report");
const result = await analyzeLocalBlueprint({
  localPath: fixturePath,
  projectId: "golden-set",
});
const measured = collectMetrics(result);

if (reportOnly) {
  console.log(`golden-set: report (${formatMetrics(measured)})`);
  process.exit(0);
}

const expected = JSON.parse(await readFile(expectedMetricsPath, "utf8"));
const failures = METRIC_NAMES.flatMap((name) => {
  const minimum = expected[name]?.min;
  const maximum = expected[name]?.max;
  return [
    ...(Number.isInteger(minimum) && measured[name] < minimum
      ? [`golden-set: ${name} ${measured[name]} < min ${minimum}`]
      : []),
    ...(Number.isInteger(maximum) && measured[name] > maximum
      ? [`golden-set: ${name} ${measured[name]} > max ${maximum}`]
      : []),
  ];
});

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`golden-set: OK (${formatMetrics(measured)})`);
