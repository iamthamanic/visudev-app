import { assertEquals } from "std/assert";
import { extractFactsFromFile } from "../facts/fact-extractors.ts";
import type { RouteScope } from "../../dto/blueprint/route-scope.dto.ts";
import { buildRouteFactsIndex } from "../internal/route-facts-index.ts";
import { buildVisuDevGraphFromFacts } from "./fact-graph.mapper.ts";
import {
  collectAstCallTargets,
  createEmptyAstParseReport,
  extractAstFactsFromFile,
  parseAstModuleGraph,
} from "./ast-call-graph.ts";
import { collectRelatedFiles } from "./call-graph.builder.ts";

const ROUTE_FILE = "routes/employees.ts";
const SERVICE_FILE = "services/employees.ts";

const ROUTE_CONTENT = `
import { createEmployee } from '../services/employees';

app.post('/api/employees', async (c) => {
  const body = await c.req.json();
  return createEmployee(body);
});
`;

const SERVICE_CONTENT = `
import { EmployeeSchema } from '../schemas/employee';

export async function createEmployee(body: unknown) {
  const parsed = EmployeeSchema.safeParse(body);
  if (!parsed.success) return { error: 'bad' };
  await supabase.from('employees').insert(parsed.data);
}
`;

function fileIndex(entries: Array<{ path: string; content: string }>) {
  return new Map(entries.map((entry) => [entry.path, entry]));
}

Deno.test("parseAstModuleGraph resolves import bindings and call targets", () => {
  const known = new Set([ROUTE_FILE, SERVICE_FILE]);
  const graph = parseAstModuleGraph(ROUTE_CONTENT, ROUTE_FILE, known);
  assertEquals(graph?.source, "ast");
  assertEquals(graph?.imports.length, 1);
  assertEquals(graph?.imports[0]?.resolvedPath, SERVICE_FILE);
  assertEquals(
    graph?.calls.some((call) => call.callee === "createEmployee"),
    true,
  );
  assertEquals(
    graph?.calls.find((call) => call.callee === "createEmployee")?.targetFile,
    SERVICE_FILE,
  );
});

Deno.test("extractFactsFromFile merges regex facts with ast-import and ast-call", () => {
  const index = fileIndex([
    { path: ROUTE_FILE, content: ROUTE_CONTENT },
    { path: SERVICE_FILE, content: SERVICE_CONTENT },
  ]);
  const facts = extractFactsFromFile(ROUTE_FILE, ROUTE_CONTENT, index);
  assertEquals(facts.some((fact) => fact.kind === "api-route"), true);
  assertEquals(facts.some((fact) => fact.kind === "ast-call"), true);
  assertEquals(facts.some((fact) => fact.kind === "ast-import"), true);
});

Deno.test("collectRelatedFiles follows AST call targets", () => {
  const index = fileIndex([
    { path: ROUTE_FILE, content: ROUTE_CONTENT },
    { path: SERVICE_FILE, content: SERVICE_CONTENT },
  ]);
  const related = collectRelatedFiles(ROUTE_FILE, index);
  assertEquals(related.includes(SERVICE_FILE), true);
});

Deno.test("AST call facts attach service facts to route scope for graph mapper", () => {
  const index = fileIndex([
    { path: ROUTE_FILE, content: ROUTE_CONTENT },
    { path: SERVICE_FILE, content: SERVICE_CONTENT },
  ]);
  const routeFacts = extractFactsFromFile(ROUTE_FILE, ROUTE_CONTENT, index);
  const serviceFacts = extractFactsFromFile(
    SERVICE_FILE,
    SERVICE_CONTENT,
    index,
  );
  const allFacts = [...routeFacts, ...serviceFacts];

  const scope: RouteScope = {
    id: "POST /api/employees",
    method: "POST",
    path: "/api/employees",
    filePath: ROUTE_FILE,
    line: 3,
    relatedFiles: collectRelatedFiles(ROUTE_FILE, index),
  };

  const routeIndex = buildRouteFactsIndex([scope], allFacts);
  const scopedFacts = routeIndex.get(scope.id) ?? [];
  assertEquals(
    scopedFacts.some((fact) => fact.kind === "schema-safe-parse"),
    true,
  );
  assertEquals(scopedFacts.some((fact) => fact.kind === "db-write"), true);

  const graph = buildVisuDevGraphFromFacts(allFacts, [scope]);
  assertEquals(graph.nodes.some((node) => node.kind === "validation"), true);
  assertEquals(graph.nodes.some((node) => node.kind === "table"), true);
  assertEquals(graph.edges.some((edge) => edge.kind === "validates"), true);
  assertEquals(graph.edges.some((edge) => edge.kind === "writes"), true);
});

Deno.test("parseAstModuleGraph returns null on invalid syntax and regex path remains", () => {
  const broken = "import { x from './y'; {{{";
  assertEquals(parseAstModuleGraph(broken, ROUTE_FILE), null);
  assertEquals(extractAstFactsFromFile(ROUTE_FILE, broken).length, 0);
  const facts = extractFactsFromFile(ROUTE_FILE, broken);
  assertEquals(Array.isArray(facts), true);
  assertEquals(collectAstCallTargets(broken, ROUTE_FILE).length, 0);
});

Deno.test("reports parse failures instead of swallowing them", () => {
  const broken = "import { x from './y'; {{{";
  const report = createEmptyAstParseReport();
  assertEquals(
    parseAstModuleGraph(broken, ROUTE_FILE, undefined, report),
    null,
  );
  assertEquals(report.filesAttempted, 1);
  assertEquals(report.filesParsed, 0);
  assertEquals(report.filesFailed, 1);
  assertEquals(report.failedSamples, [ROUTE_FILE]);
});

Deno.test("failedSamples never keep absolute host prefixes", () => {
  const broken = "import { x from './y'; {{{";
  const report = createEmptyAstParseReport();
  const abs = "/Users/alice/code/repo/src/routes/employees.ts";
  assertEquals(parseAstModuleGraph(broken, abs, undefined, report), null);
  assertEquals(report.failedSamples.length, 1);
  assertEquals(report.failedSamples[0]!.includes("/Users/alice"), false);
  assertEquals(report.failedSamples[0]!.includes("alice"), false);
  assertEquals(report.failedSamples[0], "src/routes/employees.ts");
});
