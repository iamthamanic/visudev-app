/** Line-based fact extractors for Blueprint Engine v1 (Hono, Next, Express, Meteor, Mongo, Supabase, Zod, Auth, Django, Prisma). */

import type {
  AstParseReport,
  CodeFact,
} from "../../dto/blueprint/blueprint-document.dto.ts";
import { extractAstFactsFromFile } from "../graph/ast-call-graph.ts";
import type { FileIndexEntry } from "../graph/call-graph.builder.ts";
import {
  isComposeDescriptorPath,
  isK8sDescriptorPath,
  parseDeployDescriptors,
} from "./compose-k8s-descriptors.ts";

function makeFactId(filePath: string, line: number, kind: string): string {
  const safePath = filePath.replace(/[^a-zA-Z0-9]+/g, "-").replace(
    /^-|-$/g,
    "",
  );
  return `fact-${safePath}-${line}-${kind}`;
}

function trimSnippet(line: string, max = 120): string {
  const t = line.trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

function isJsTsFile(filePath: string): boolean {
  return /\.(tsx?|jsx?|mts|cts)$/i.test(filePath);
}

function isPythonFile(filePath: string): boolean {
  return /\.py$/i.test(filePath);
}

function isPrismaFile(filePath: string): boolean {
  return /\.prisma$/i.test(filePath);
}

function isComposeFile(filePath: string): boolean {
  return isComposeDescriptorPath(filePath);
}

function isK8sFile(filePath: string): boolean {
  return isK8sDescriptorPath(filePath);
}

export function extractFactsFromFile(
  filePath: string,
  content: string,
  fileIndex?: ReadonlyMap<string, FileIndexEntry>,
  parseReport?: AstParseReport,
  resolutionPaths?: ReadonlySet<string>,
): CodeFact[] {
  if (isPrismaFile(filePath)) {
    return extractPrismaFacts(filePath, content);
  }
  if (isComposeFile(filePath)) {
    return [
      ...extractComposeInfraFacts(filePath, content),
      ...extractDeployDescriptorFacts(filePath, content),
    ];
  }
  if (isK8sFile(filePath)) {
    return extractDeployDescriptorFacts(filePath, content);
  }
  if (isPythonFile(filePath)) {
    return extractDjangoFacts(filePath, content);
  }

  const regexFacts = extractRegexFactsFromFile(filePath, content);
  const astFacts = isJsTsFile(filePath)
    ? extractAstFactsFromFile(
      filePath,
      content,
      fileIndex,
      parseReport,
      resolutionPaths,
    )
    : [];
  return mergeFacts(regexFacts, astFacts);
}

function extractRegexFactsFromFile(
  filePath: string,
  content: string,
): CodeFact[] {
  const facts: CodeFact[] = [];
  const routeKeys = new Set<string>();
  const routeFramework = resolveRouteFramework(filePath, content);
  const lines = content.split("\n");

  lines.forEach((line, index) => {
    const lineNum = index + 1;
    extractRouteFrameworkFacts(
      filePath,
      line,
      lineNum,
      facts,
      routeKeys,
      routeFramework,
    );
    extractNextRouteHandlers(filePath, line, lineNum, facts);
    extractRequestBody(filePath, line, lineNum, facts);
    extractValidation(filePath, line, lineNum, facts);
    extractAuth(filePath, line, lineNum, facts);
    extractSupabase(filePath, line, lineNum, facts);
    extractPrismaClient(filePath, line, lineNum, facts);
    extractExternalApi(filePath, line, lineNum, facts);
    extractRateLimit(filePath, line, lineNum, facts);
    extractErrorStatus(filePath, line, lineNum, facts);
  });

  // Multi-line router.get(\n  '/path'…) — common in browo Express modules.
  extractExpressMultilineRoutes(
    filePath,
    content,
    facts,
    routeKeys,
    routeFramework,
  );
  extractExpressMountPrefixes(filePath, content, facts);

  // Rocket.Chat / Meteor: methods + publications as units; registerModel / Mongo.Collection as DB.
  extractMeteorMethods(filePath, content, facts, routeKeys);
  extractMeteorPublications(filePath, content, facts, routeKeys);
  extractMongoRegisterModels(filePath, content, facts);
  extractMongoCollections(filePath, content, facts);

  return facts;
}

/** Map Prisma datasource provider → honest infra service label (no invention). */
function prismaProviderToService(provider: string): string | null {
  const normalized = provider.trim().toLowerCase();
  if (normalized === "postgresql" || normalized === "postgres") {
    return "PostgreSQL";
  }
  if (normalized === "mysql" || normalized === "mariadb") return "MySQL";
  if (normalized === "mongodb" || normalized === "mongo") return "MongoDB";
  if (normalized === "sqlite") return "SQLite";
  return null;
}

/** Compose image line → Redis / PostgreSQL (and valkey→Redis). */
function composeImageToService(image: string): string | null {
  const normalized = image.trim().toLowerCase();
  if (
    /^postgres(?:ql)?(?:[:@/]|$)/.test(normalized) ||
    /\/postgres(?:ql)?(?:[:@/]|$)/.test(normalized)
  ) {
    return "PostgreSQL";
  }
  if (
    /^redis(?:[:@/]|$)/.test(normalized) ||
    /\/redis(?:[:@/]|$)/.test(normalized)
  ) {
    return "Redis";
  }
  if (
    /^valkey(?:[:@/]|$)/.test(normalized) ||
    /\/valkey(?:[:@/]|$)/.test(normalized)
  ) {
    return "Redis";
  }
  return null;
}

/** Prisma schema.prisma → table facts + datasource provider infra (visudev-gapclose P3-2). */
function extractPrismaFacts(filePath: string, content: string): CodeFact[] {
  const facts: CodeFact[] = [];
  const lines = content.split("\n");
  const seenServices = new Set<string>();
  lines.forEach((line, index) => {
    const lineNum = index + 1;
    const providerMatch = line.match(
      /^\s*provider\s*=\s*["']([A-Za-z0-9_]+)["']/,
    );
    if (providerMatch) {
      const service = prismaProviderToService(providerMatch[1] ?? "");
      if (service && !seenServices.has(service)) {
        seenServices.add(service);
        facts.push({
          id: makeFactId(filePath, lineNum, "infra-service"),
          kind: "infra-service",
          filePath,
          line: lineNum,
          snippet: trimSnippet(line),
          metadata: {
            service,
            source: "prisma-datasource",
            provider: providerMatch[1],
            framework: "prisma",
          },
        });
      }
    }
    const modelMatch = line.match(/^\s*model\s+([A-Za-z_][A-Za-z0-9_]*)\s*\{/);
    if (!modelMatch) return;
    const table = modelMatch[1];
    facts.push({
      id: makeFactId(filePath, lineNum, "db-write"),
      kind: "db-write",
      filePath,
      line: lineNum,
      snippet: trimSnippet(line),
      metadata: { table, operation: "prisma-model", framework: "prisma" },
    });
  });
  return facts;
}

/** docker-compose.yml → Postgres/Redis infra facts (visudev-gapclose P3-2). */
function extractComposeInfraFacts(
  filePath: string,
  content: string,
): CodeFact[] {
  const facts: CodeFact[] = [];
  const seenServices = new Set<string>();
  const lines = content.split("\n");
  lines.forEach((line, index) => {
    const lineNum = index + 1;
    const imageMatch = line.match(/^\s*image:\s*["']?([^\s"'#]+)/);
    if (!imageMatch) return;
    const image = imageMatch[1] ?? "";
    const service = composeImageToService(image);
    if (!service || seenServices.has(service)) return;
    seenServices.add(service);
    facts.push({
      id: makeFactId(filePath, lineNum, "infra-service"),
      kind: "infra-service",
      filePath,
      line: lineNum,
      snippet: trimSnippet(line),
      metadata: {
        service,
        source: "docker-compose",
        framework: "docker-compose",
        // Keep image out of export allowlist (tags/digests); service name is enough.
      },
    });
  });
  return facts;
}

function joinMetaList(values: string[]): string | undefined {
  if (values.length === 0) return undefined;
  return values.join(",");
}

/** Compose/K8s descriptors → service facts with env/ports/networks (AUF-3). */
function extractDeployDescriptorFacts(
  filePath: string,
  content: string,
): CodeFact[] {
  return parseDeployDescriptors(filePath, content).map((service) => {
    const metadata: Record<string, string> = {
      service: service.name,
      source: service.source,
      framework: service.source,
    };
    if (service.env) metadata.env = service.env;
    if (service.region) metadata.region = service.region;
    const ports = joinMetaList(service.ports);
    if (ports) metadata.ports = ports;
    const networks = joinMetaList(service.networks);
    if (networks) metadata.networks = networks;
    const dependsOn = joinMetaList(service.dependsOn);
    if (dependsOn) metadata.dependsOn = dependsOn;
    return {
      id: makeFactId(filePath, service.line, "deploy-service"),
      kind: "deploy-service",
      filePath,
      line: service.line,
      snippet: trimSnippet(service.snippet),
      metadata,
    };
  });
}

/** Normalize Django path()/re_path() route strings into slash paths. */
function normalizeDjangoRoutePath(raw: string): string {
  let route = raw.trim();
  if (route.startsWith("^")) route = route.slice(1);
  if (route.endsWith("$")) route = route.slice(0, -1);
  // Strip common re_path named groups: (?P<id>[^/.]+) → :id
  route = route.replace(/\(\?P<([A-Za-z_][\w]*)>[^)]+\)/g, ":$1");
  // Strip unnamed regex groups used as segments
  route = route.replace(/\([^)]+\)/g, "*");
  route = route.replace(/\/+/g, "/");
  if (!route.startsWith("/")) route = `/${route}`;
  return route === "/" ? "/" : route.replace(/\/$/, "") || "/";
}

function extractDjangoUrlPatterns(
  filePath: string,
  line: string,
  lineNum: number,
  facts: CodeFact[],
  routeKeys: Set<string>,
): void {
  const pathMatch = line.match(
    /(?:path|re_path)\s*\(\s*(?:r)?["'`]([^"'`]+)["'`]/,
  );
  if (!pathMatch) return;
  const routePath = normalizeDjangoRoutePath(pathMatch[1]);
  const key = `ALL:${routePath}`;
  if (routeKeys.has(key)) return;
  routeKeys.add(key);
  facts.push({
    id: makeFactId(filePath, lineNum, "api-route"),
    kind: "api-route",
    filePath,
    line: lineNum,
    snippet: trimSnippet(line),
    metadata: {
      method: "ALL",
      path: routePath,
      framework: "django",
    },
  });
}

function extractDjangoViewRoutes(
  filePath: string,
  line: string,
  lineNum: number,
  facts: CodeFact[],
): void {
  if (
    !/@api_view\s*\(|class\s+\w+\s*\(.*APIView|class\s+\w+\s*\(.*ViewSet/.test(
      line,
    )
  ) {
    return;
  }
  facts.push({
    id: makeFactId(filePath, lineNum, "api-route"),
    kind: "api-route",
    filePath,
    line: lineNum,
    snippet: trimSnippet(line),
    metadata: {
      method: "ALL",
      path: `/${filePath.replace(/\\/g, "/")}`,
      framework: "django",
    },
  });
}

function extractDjangoAuthChecks(
  filePath: string,
  line: string,
  lineNum: number,
  facts: CodeFact[],
): void {
  if (
    !/permission_classes|has_permission|IsAuthenticated|DjangoModelPermissions|BasePermission/
      .test(line)
  ) {
    return;
  }
  facts.push({
    id: makeFactId(filePath, lineNum, "auth-check"),
    kind: "auth-check",
    filePath,
    line: lineNum,
    snippet: trimSnippet(line),
    metadata: { framework: "django" },
  });
}

function extractDjangoModels(
  filePath: string,
  line: string,
  lineNum: number,
  facts: CodeFact[],
): void {
  if (
    !/class\s+\w+\s*\(.*models\.Model/.test(line) &&
    !/models\.Model\)/.test(line)
  ) {
    return;
  }
  const modelName = line.match(/class\s+(\w+)\s*\(/)?.[1];
  if (!modelName) return;
  facts.push({
    id: makeFactId(filePath, lineNum, "db-write"),
    kind: "db-write",
    filePath,
    line: lineNum,
    snippet: trimSnippet(line),
    metadata: {
      table: modelName,
      operation: "django-model",
      framework: "django",
    },
  });
}

function extractDjangoManageEntrypoint(
  filePath: string,
  content: string,
  facts: CodeFact[],
): void {
  if (!filePath.toLowerCase().endsWith("manage.py")) return;
  if (!/django|DJANGO_SETTINGS_MODULE/.test(content)) return;
  facts.push({
    id: makeFactId(filePath, 1, "api-route"),
    kind: "api-route",
    filePath,
    line: 1,
    snippet: "Django manage.py entrypoint",
    metadata: {
      method: "ALL",
      path: "/django",
      framework: "django",
    },
  });
}

/** Django urls/views/permissions → api-route + auth facts for Softort Plane. */
function extractDjangoFacts(filePath: string, content: string): CodeFact[] {
  const facts: CodeFact[] = [];
  const routeKeys = new Set<string>();
  const lines = content.split("\n");

  lines.forEach((line, index) => {
    const lineNum = index + 1;
    const trimmed = line.trim();
    extractDjangoUrlPatterns(filePath, trimmed, lineNum, facts, routeKeys);
    extractDjangoViewRoutes(filePath, trimmed, lineNum, facts);
    extractDjangoAuthChecks(filePath, trimmed, lineNum, facts);
    extractDjangoModels(filePath, trimmed, lineNum, facts);
  });

  extractDjangoManageEntrypoint(filePath, content, facts);
  return facts;
}

function mergeFacts(regexFacts: CodeFact[], astFacts: CodeFact[]): CodeFact[] {
  if (astFacts.length === 0) return regexFacts;
  const seen = new Set(regexFacts.map((fact) => fact.id));
  const merged = [...regexFacts];
  for (const fact of astFacts) {
    if (seen.has(fact.id)) continue;
    seen.add(fact.id);
    merged.push(fact);
  }
  return merged;
}

function resolveRouteFramework(
  filePath: string,
  content: string,
): "hono" | "express" {
  if (/from\s+['"]hono['"]|from\s+['"]@hono\//.test(content)) return "hono";
  if (
    /from\s+['"]express['"]|require\(\s*['"]express['"]\s*\)/.test(content)
  ) return "express";
  if (/\basync\s*\(\s*c\s*\)|\bc\.req\.|\bc\.json\(/.test(content)) {
    return "hono";
  }
  if (isLikelyExpressRouteFile(filePath)) return "express";
  return "hono";
}

function extractRouteFrameworkFacts(
  filePath: string,
  line: string,
  lineNum: number,
  facts: CodeFact[],
  routeKeys: Set<string>,
  routeFramework: "hono" | "express",
): void {
  if (routeFramework === "express") {
    extractExpressRoutes(filePath, line, lineNum, facts, routeKeys);
    return;
  }
  extractHonoRoutes(filePath, line, lineNum, facts, routeKeys);
}

function extractHonoRoutes(
  filePath: string,
  line: string,
  lineNum: number,
  facts: CodeFact[],
  routeKeys: Set<string>,
): void {
  const honoRegex =
    /\bapp\.(get|post|put|patch|delete|all)\s*\(\s*['"`]([^'"`]+)['"`]/gi;
  let m: RegExpExecArray | null;
  while ((m = honoRegex.exec(line)) !== null) {
    const method = m[1].toUpperCase();
    const path = m[2];
    const key = `${filePath}:${lineNum}:${method}:${path}`;
    if (routeKeys.has(key)) continue;
    routeKeys.add(key);
    facts.push({
      id: makeFactId(filePath, lineNum, "api-route"),
      kind: "api-route",
      filePath,
      line: lineNum,
      snippet: trimSnippet(line),
      metadata: { method: m[1].toUpperCase(), path: m[2], framework: "hono" },
    });
  }
}

function extractExpressRoutes(
  filePath: string,
  line: string,
  lineNum: number,
  facts: CodeFact[],
  routeKeys: Set<string>,
): void {
  extractExpressRouteMatches(
    filePath,
    line,
    lineNum,
    facts,
    routeKeys,
    /\bapp\.(get|post|put|patch|delete|all)\s*\(\s*['"`]([^'"`]+)['"`]/gi,
  );
  if (!isLikelyExpressRouteFile(filePath)) return;
  extractExpressRouteMatches(
    filePath,
    line,
    lineNum,
    facts,
    routeKeys,
    /\brouter\.(get|post|put|patch|delete|all)\s*\(\s*['"`]([^'"`]+)['"`]/gi,
  );
}

function isLikelyExpressRouteFile(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, "/").toLowerCase();
  return normalized.includes("/routes/") ||
    normalized.endsWith(".routes.ts") ||
    normalized.endsWith(".routes.js") ||
    normalized.endsWith(".routes.tsx") ||
    normalized.endsWith(".routes.jsx");
}

function extractExpressRouteMatches(
  filePath: string,
  line: string,
  lineNum: number,
  facts: CodeFact[],
  routeKeys: Set<string>,
  expressRegex: RegExp,
): void {
  let m: RegExpExecArray | null;
  while ((m = expressRegex.exec(line)) !== null) {
    const method = m[1].toUpperCase();
    const path = m[2];
    const key = `${filePath}:${lineNum}:${method}:${path}`;
    if (routeKeys.has(key)) continue;
    routeKeys.add(key);
    facts.push({
      id: makeFactId(filePath, lineNum, `api-route-express-${method}-${path}`),
      kind: "api-route",
      filePath,
      line: lineNum,
      snippet: trimSnippet(line),
      metadata: {
        method,
        path,
        framework: "express",
      },
    });
  }
}

/** router.get(\n  '/path', …) — path on following line (browo leaves.routes.ts). */
function extractExpressMultilineRoutes(
  filePath: string,
  content: string,
  facts: CodeFact[],
  routeKeys: Set<string>,
  routeFramework: "hono" | "express",
): void {
  if (routeFramework !== "express" || !isLikelyExpressRouteFile(filePath)) {
    return;
  }
  const multiline =
    /\b(app|router)\.(get|post|put|patch|delete|all)\s*\(\s*[\r\n]+\s*['"`]([^'"`]+)['"`]/gi;
  let m: RegExpExecArray | null;
  while ((m = multiline.exec(content)) !== null) {
    const method = m[2].toUpperCase();
    const path = m[3];
    const lineNum = content.slice(0, m.index).split("\n").length;
    const key = `${filePath}:${lineNum}:${method}:${path}`;
    if (routeKeys.has(key)) continue;
    routeKeys.add(key);
    const snippetLine = content.split("\n")[lineNum - 1] ?? m[0];
    facts.push({
      id: makeFactId(filePath, lineNum, `api-route-express-${method}-${path}`),
      kind: "api-route",
      filePath,
      line: lineNum,
      snippet: trimSnippet(snippetLine),
      metadata: { method, path, framework: "express" },
    });
  }
}

/** app.use('/api/leaves', router) → route-mount facts for scope path join. */
function extractExpressMountPrefixes(
  filePath: string,
  content: string,
  facts: CodeFact[],
): void {
  if (!/\bexpress\b|\bRouter\b|from ['"]express['"]/.test(content)) return;
  const mountRe =
    /\bapp\.use\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*([A-Za-z_$][\w$]*)/g;
  let m: RegExpExecArray | null;
  while ((m = mountRe.exec(content)) !== null) {
    const mountPath = m[1];
    if (!mountPath.startsWith("/")) continue;
    const lineNum = content.slice(0, m.index).split("\n").length;
    facts.push({
      id: makeFactId(filePath, lineNum, `route-mount-${mountPath}`),
      kind: "route-mount",
      filePath,
      line: lineNum,
      snippet: trimSnippet(m[0]),
      metadata: {
        path: mountPath,
        routerBinding: m[2],
        framework: "express",
      },
    });
  }
}

function extractNextRouteHandlers(
  filePath: string,
  line: string,
  lineNum: number,
  facts: CodeFact[],
): void {
  if (!filePath.includes("route.ts") && !filePath.includes("route.tsx")) {
    return;
  }
  const nextRegex =
    /export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/;
  const m = line.match(nextRegex);
  if (m) {
    const path = inferNextRoutePath(filePath);
    facts.push({
      id: makeFactId(filePath, lineNum, "api-route"),
      kind: "api-route",
      filePath,
      line: lineNum,
      snippet: trimSnippet(line),
      metadata: { method: m[1], path, framework: "next-app-router" },
    });
  }
}

function inferNextRoutePath(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/");
  const appIdx = normalized.indexOf("/app/");
  if (appIdx >= 0) {
    let segment = normalized.slice(appIdx + 5);
    segment = segment.replace(/\/route\.(tsx?|jsx?)$/, "");
    return segment ? `/${segment}` : "/";
  }
  const pagesIdx = normalized.indexOf("/pages/api/");
  if (pagesIdx >= 0) {
    let segment = normalized.slice(pagesIdx + 11);
    segment = segment.replace(/\.(tsx?|jsx?)$/, "");
    return `/api/${segment}`;
  }
  return filePath;
}

function extractRequestBody(
  filePath: string,
  line: string,
  lineNum: number,
  facts: CodeFact[],
): void {
  if (
    line.includes("req.json()") ||
    line.includes("request.json()") ||
    line.includes("c.req.json()") ||
    line.includes("await c.req.parseBody") ||
    line.match(/\bbody\s*=\s*await\s+/)
  ) {
    facts.push({
      id: makeFactId(filePath, lineNum, "request-body-read"),
      kind: "request-body-read",
      filePath,
      line: lineNum,
      snippet: trimSnippet(line),
      metadata: {},
    });
  }
}

function extractValidation(
  filePath: string,
  line: string,
  lineNum: number,
  facts: CodeFact[],
): void {
  if (line.includes("safeParse(")) {
    facts.push({
      id: makeFactId(filePath, lineNum, "schema-safe-parse"),
      kind: "schema-safe-parse",
      filePath,
      line: lineNum,
      snippet: trimSnippet(line),
      metadata: { library: "zod-like" },
    });
  } else if (
    line.match(/\.\s*parse\s*\(/) &&
    (line.includes("Schema") || line.includes("schema"))
  ) {
    facts.push({
      id: makeFactId(filePath, lineNum, "schema-parse"),
      kind: "schema-parse",
      filePath,
      line: lineNum,
      snippet: trimSnippet(line),
      metadata: { library: "zod-like" },
    });
  }
}

function extractAuth(
  filePath: string,
  line: string,
  lineNum: number,
  facts: CodeFact[],
): void {
  const authPatterns = [
    "getUser(",
    "auth.getUser",
    "getSession(",
    "requireAuth",
    "requireProjectOwner",
    "authenticateApiKey",
    "authorize(",
    "authorizeAny(",
    "Authorization",
  ];
  if (authPatterns.some((p) => line.includes(p))) {
    facts.push({
      id: makeFactId(filePath, lineNum, "auth-check"),
      kind: "auth-check",
      filePath,
      line: lineNum,
      snippet: trimSnippet(line),
      metadata: {},
    });
  }
}

function extractSupabase(
  filePath: string,
  line: string,
  lineNum: number,
  facts: CodeFact[],
): void {
  if (!line.includes("supabase.from(") && !line.includes(".from(")) return;
  const dbMatch = line.match(/\.from\s*\(\s*["'`]([^"'`]+)["'`]/);
  if (!dbMatch) return;
  const table = dbMatch[1];
  let operation = "select";
  if (line.includes(".insert(")) operation = "insert";
  else if (line.includes(".update(")) operation = "update";
  else if (line.includes(".delete(")) operation = "delete";
  else if (line.includes(".upsert(")) operation = "upsert";

  facts.push({
    id: makeFactId(
      filePath,
      lineNum,
      operation === "select" ? "db-read" : "db-write",
    ),
    kind: operation === "select" ? "db-read" : "db-write",
    filePath,
    line: lineNum,
    snippet: trimSnippet(line),
    metadata: { table, operation },
  });
}

/** prisma.model / this.prisma.model ops → db facts (Formbricks + browo Nest/Express services). */
function extractPrismaClient(
  filePath: string,
  line: string,
  lineNum: number,
  facts: CodeFact[],
): void {
  const match = line.match(
    /\b(?:this\.)?prisma\.(\w+)\.(findMany|findFirst|findUnique|create|createMany|update|updateMany|upsert|delete|deleteMany|count|aggregate)\s*\(/,
  );
  if (!match) return;
  const table = match[1];
  const op = match[2];
  const isRead = /^(find|count|aggregate)/.test(op);
  facts.push({
    id: makeFactId(filePath, lineNum, isRead ? "db-read" : "db-write"),
    kind: isRead ? "db-read" : "db-write",
    filePath,
    line: lineNum,
    snippet: trimSnippet(line),
    metadata: { table, operation: op, framework: "prisma" },
  });
}

/**
 * Meteor.methods({ name() {} }) → api-route units (Rocket.Chat RC-W2).
 * Path convention: /meteor/<methodName>, method METHOD — feeds existing execution pipeline.
 * Only top-level object keys (brace depth 0) are registered — nested calls like check() are ignored.
 */
function extractMeteorMethods(
  filePath: string,
  content: string,
  facts: CodeFact[],
  routeKeys: Set<string>,
): void {
  if (!/\bMeteor\.methods\b/.test(content)) return;
  const openRe = /Meteor\.methods(?:\s*<[^>]*>)?\s*\(\s*\{/g;
  let openMatch: RegExpExecArray | null;
  while ((openMatch = openRe.exec(content)) !== null) {
    const braceStart = content.indexOf("{", openMatch.index);
    if (braceStart < 0) continue;
    const body = sliceBalancedBlock(content, braceStart);
    if (!body) continue;
    const bodyStartLine = content.slice(0, braceStart).split("\n").length;
    let depth = 0;
    const lines = body.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? "";
      const lineNum = bodyStartLine + i;
      if (depth === 0) {
        const fnMatch = line.match(
          /^\s*(?:async\s+)?([A-Za-z_$][\w$]*)\s*\(/,
        );
        const keyMatch = line.match(
          /^\s*['"`]([A-Za-z_$][\w$]*)['"`]\s*:/,
        );
        const name = fnMatch?.[1] ?? keyMatch?.[1];
        if (name && !isMeteorNoiseIdentifier(name)) {
          const path = `/meteor/${name}`;
          const key = `${filePath}:${lineNum}:METHOD:${path}`;
          if (!routeKeys.has(key)) {
            routeKeys.add(key);
            facts.push({
              id: makeFactId(filePath, lineNum, `api-route-meteor-${name}`),
              kind: "api-route",
              filePath,
              line: lineNum,
              snippet: trimSnippet(line),
              metadata: {
                method: "METHOD",
                path,
                framework: "meteor",
                unit: "meteor-method",
              },
            });
          }
        }
      }
      for (const ch of line) {
        if (ch === "{") depth += 1;
        else if (ch === "}") depth = Math.max(0, depth - 1);
      }
    }
  }
}

/** Meteor.publish('name', …) → api-route publication units. */
function extractMeteorPublications(
  filePath: string,
  content: string,
  facts: CodeFact[],
  routeKeys: Set<string>,
): void {
  const lines = content.split("\n");
  const pubRe = /\bMeteor\.publish\s*\(\s*['"`]([^'"`]+)['"`]/g;
  lines.forEach((line, index) => {
    const lineNum = index + 1;
    let m: RegExpExecArray | null;
    pubRe.lastIndex = 0;
    while ((m = pubRe.exec(line)) !== null) {
      const name = m[1];
      if (!name) continue;
      const path = `/meteor/publish/${name}`;
      const key = `${filePath}:${lineNum}:PUBLISH:${path}`;
      if (routeKeys.has(key)) continue;
      routeKeys.add(key);
      facts.push({
        id: makeFactId(filePath, lineNum, `api-route-meteor-pub-${name}`),
        kind: "api-route",
        filePath,
        line: lineNum,
        snippet: trimSnippet(line),
        metadata: {
          method: "PUBLISH",
          path,
          framework: "meteor",
          unit: "meteor-publication",
        },
      });
    }
  });
}

/** registerModel('IMessagesModel', …) → mongodb collection/table facts (Rocket.Chat). */
function extractMongoRegisterModels(
  filePath: string,
  content: string,
  facts: CodeFact[],
): void {
  const lines = content.split("\n");
  const modelRe = /\bregisterModel\s*\(\s*['"`]([^'"`]+)['"`]/g;
  lines.forEach((line, index) => {
    const lineNum = index + 1;
    let m: RegExpExecArray | null;
    modelRe.lastIndex = 0;
    while ((m = modelRe.exec(line)) !== null) {
      const modelId = m[1];
      const table = mongoTableFromModelId(modelId);
      if (!table) continue;
      facts.push({
        id: makeFactId(filePath, lineNum, `db-write-mongo-${table}`),
        kind: "db-write",
        filePath,
        line: lineNum,
        snippet: trimSnippet(line),
        metadata: {
          table,
          operation: "register-model",
          framework: "mongodb",
          modelId,
        },
      });
    }
  });
}

/** new Mongo.Collection('name') → mongodb collection facts. */
function extractMongoCollections(
  filePath: string,
  content: string,
  facts: CodeFact[],
): void {
  const lines = content.split("\n");
  const colRe =
    /\b(?:new\s+)?Mongo\.Collection(?:\s*<[^>]*>)?\s*\(\s*['"`]([^'"`]+)['"`]/g;
  lines.forEach((line, index) => {
    const lineNum = index + 1;
    let m: RegExpExecArray | null;
    colRe.lastIndex = 0;
    while ((m = colRe.exec(line)) !== null) {
      const table = m[1];
      if (!table) continue;
      facts.push({
        id: makeFactId(filePath, lineNum, `db-write-mongo-col-${table}`),
        kind: "db-write",
        filePath,
        line: lineNum,
        snippet: trimSnippet(line),
        metadata: {
          table,
          operation: "mongo-collection",
          framework: "mongodb",
        },
      });
    }
  });
}

function sliceBalancedBlock(source: string, openBraceIndex: number): string {
  if (source[openBraceIndex] !== "{") return "";
  let depth = 0;
  for (let i = openBraceIndex; i < source.length; i++) {
    const ch = source[i];
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(openBraceIndex + 1, i);
      }
    }
  }
  return "";
}

function isMeteorNoiseIdentifier(name: string): boolean {
  return /^(?:async|await|function|if|for|while|return|const|let|var|throw|new|class|import|export|typeof|this)$/
    .test(name);
}

/** IMessagesModel → Messages; ILivechatDepartmentAgentsModel → LivechatDepartmentAgents */
function mongoTableFromModelId(modelId: string): string {
  let name = modelId.trim();
  if (name.startsWith("I") && name.length > 1 && /[A-Z]/.test(name[1] ?? "")) {
    name = name.slice(1);
  }
  if (name.endsWith("Model")) name = name.slice(0, -"Model".length);
  return name.length > 0 ? name : "";
}

function extractExternalApi(
  filePath: string,
  line: string,
  lineNum: number,
  facts: CodeFact[],
): void {
  if (line.includes("fetch(") || line.includes("axios.")) {
    facts.push({
      id: makeFactId(filePath, lineNum, "external-api-call"),
      kind: "external-api-call",
      filePath,
      line: lineNum,
      snippet: trimSnippet(line),
      metadata: {},
    });
  }
}

function extractRateLimit(
  filePath: string,
  line: string,
  lineNum: number,
  facts: CodeFact[],
): void {
  if (
    line.toLowerCase().includes("ratelimit") ||
    line.includes("rate-limit") ||
    line.includes("rateLimit")
  ) {
    facts.push({
      id: makeFactId(filePath, lineNum, "rate-limit"),
      kind: "rate-limit",
      filePath,
      line: lineNum,
      snippet: trimSnippet(line),
      metadata: {},
    });
  }
}

function extractErrorStatus(
  filePath: string,
  line: string,
  lineNum: number,
  facts: CodeFact[],
): void {
  if (line.includes("401") || line.match(/\b401\b/)) {
    facts.push({
      id: makeFactId(filePath, lineNum, "auth-deny-401"),
      kind: "auth-deny-401",
      filePath,
      line: lineNum,
      snippet: trimSnippet(line),
      metadata: { status: 401 },
    });
  }
  if (line.includes("400") || line.match(/\b400\b/)) {
    facts.push({
      id: makeFactId(filePath, lineNum, "validation-deny-400"),
      kind: "validation-deny-400",
      filePath,
      line: lineNum,
      snippet: trimSnippet(line),
      metadata: { status: 400 },
    });
  }
}
