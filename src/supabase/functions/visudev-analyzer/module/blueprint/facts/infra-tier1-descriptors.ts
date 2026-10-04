/**
 * Tier-1 infrastructure detectors beyond Compose/K8s (PR-14 / infrastructure-detection).
 * Evidence from Dockerfile, package.json SDK deps, and dotenv *names* only (never values).
 * Location: src/supabase/functions/visudev-analyzer/module/blueprint/facts/infra-tier1-descriptors.ts
 */

import type { CodeFact } from "../../dto/blueprint/blueprint-document.dto.ts";

const MAX_ENV_NAMES = 24;
const MAX_SDK_SERVICES = 12;
const MAX_NAME_LEN = 64;

/** Known npm packages → honest infra engine label (dependency presence only). */
const PACKAGE_TO_SERVICE: ReadonlyArray<readonly [RegExp, string]> = [
  [/^pg$|^postgres$|^postgresql$/, "PostgreSQL"],
  [/^mysql$|^mysql2$|^mariadb$/, "MySQL"],
  [/^mongodb$|^mongoose$/, "MongoDB"],
  [/^ioredis$|^redis$|^@redis\/client$/, "Redis"],
  [/^better-sqlite3$|^sqlite3$/, "SQLite"],
];

/** Env *names* that imply a specific engine (values never read). */
const ENV_NAME_TO_SERVICE: ReadonlyArray<readonly [RegExp, string]> = [
  // DATABASE_URL alone is ambiguous — do not invent an engine from it.
  [/^POSTGRES(_|$)|^PG(HOST|PORT|USER|PASSWORD|DATABASE|DATA)?$/, "PostgreSQL"],
  [/^MYSQL(_|$)|^MARIADB(_|$)/, "MySQL"],
  [/^MONGO(_|$)|^MONGODB(_|$)/, "MongoDB"],
  [/^REDIS(_|$)|^VALKEY(_|$)/, "Redis"],
  [/^SQLITE(_|$)/, "SQLite"],
];
/** Dockerfile / Compose image refs → engine label. */
const IMAGE_TO_SERVICE: ReadonlyArray<readonly [RegExp, string]> = [
  [/(?:^|\/)postgres(?:ql)?(?:[:@/]|$)/, "PostgreSQL"],
  [/(?:^|\/)mysql(?:[:@/]|$)|(?:^|\/)mariadb(?:[:@/]|$)/, "MySQL"],
  [/(?:^|\/)mongo(?:db)?(?:[:@/]|$)/, "MongoDB"],
  [/(?:^|\/)redis(?:[:@/]|$)|(?:^|\/)valkey(?:[:@/]|$)/, "Redis"],
];

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

function basename(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/");
  const parts = normalized.split("/");
  return parts[parts.length - 1] ?? normalized;
}

export function isDockerfilePath(filePath: string): boolean {
  const base = basename(filePath);
  return (
    /^Dockerfile$/i.test(base) ||
    /^Dockerfile\.[A-Za-z0-9._-]+$/i.test(base) ||
    /\.Dockerfile$/i.test(base)
  );
}

export function isPackageJsonPath(filePath: string): boolean {
  return basename(filePath).toLowerCase() === "package.json";
}

/** .env.example / .env.sample / .env.template — never live .env with secrets. */
export function isSafeEnvExamplePath(filePath: string): boolean {
  const base = basename(filePath).toLowerCase();
  if (base === ".env" || base === "env") return false;
  return (
    /^\.env\.(example|sample|template|dist)$/.test(base) ||
    /^(env|dotenv)\.(example|sample|template)$/.test(base)
  );
}

export function isTier1InfraDescriptorPath(filePath: string): boolean {
  return (
    isDockerfilePath(filePath) ||
    isPackageJsonPath(filePath) ||
    isSafeEnvExamplePath(filePath)
  );
}

function imageToService(image: string): string | null {
  const normalized = image.trim().toLowerCase();
  if (!normalized) return null;
  for (const [pattern, service] of IMAGE_TO_SERVICE) {
    if (pattern.test(normalized)) return service;
  }
  return null;
}

function packageToService(pkg: string): string | null {
  const name = pkg.trim().toLowerCase();
  if (!name) return null;
  for (const [pattern, service] of PACKAGE_TO_SERVICE) {
    if (pattern.test(name)) return service;
  }
  return null;
}

function envNameToService(name: string): string | null {
  const upper = name.trim().toUpperCase();
  if (!upper || upper.length > MAX_NAME_LEN) return null;
  for (const [pattern, service] of ENV_NAME_TO_SERVICE) {
    if (pattern.test(upper)) return service;
  }
  return null;
}

function isSafeEnvName(name: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(name);
}

/** Strip values from dotenv lines; keep NAME= only in snippet. */
function envNameSnippet(name: string): string {
  return `${name}=***`;
}

/**
 * Dockerfile → deploy-service (app container) + optional infra-service from FROM images.
 * EXPOSE ports become metadata.ports (no secrets).
 */
export function extractDockerfileFacts(
  filePath: string,
  content: string,
): CodeFact[] {
  const facts: CodeFact[] = [];
  const seenInfra = new Set<string>();
  const ports: string[] = [];
  let firstFromLine = 0;
  let firstFromImage = "";
  const lines = content.split("\n");

  lines.forEach((line, index) => {
    const lineNum = index + 1;
    const fromMatch = line.match(/^\s*FROM\s+(?:--platform=\S+\s+)?([^\s]+)/i);
    if (fromMatch) {
      const image = fromMatch[1] ?? "";
      if (!firstFromLine) {
        firstFromLine = lineNum;
        firstFromImage = image;
      }
      const service = imageToService(image);
      if (service && !seenInfra.has(service)) {
        seenInfra.add(service);
        facts.push({
          id: makeFactId(filePath, lineNum, "infra-service"),
          kind: "infra-service",
          filePath,
          line: lineNum,
          snippet: trimSnippet(`FROM ${image.split("@")[0] ?? image}`),
          metadata: {
            service,
            source: "dockerfile",
            framework: "dockerfile",
          },
        });
      }
    }
    const exposeMatch = line.match(/^\s*EXPOSE\s+(.+)$/i);
    if (exposeMatch) {
      const raw = exposeMatch[1] ?? "";
      for (const token of raw.split(/\s+/)) {
        const port = token.replace(/\/(tcp|udp)$/i, "").trim();
        if (/^\d{2,5}$/.test(port) && ports.length < 16) ports.push(port);
      }
    }
  });

  if (firstFromLine > 0) {
    const fromEngine = imageToService(firstFromImage);
    const fromPath = basename(filePath)
      .replace(/^Dockerfile\.?/i, "")
      .replace(/\W+/g, "-")
      .replace(/^-|-$/g, "");
    // Engine images still get a deploy unit named "app"; named Dockerfiles keep their suffix.
    const label = fromEngine
      ? "app"
      : (fromPath || "app").slice(0, MAX_NAME_LEN);
    const metadata: Record<string, string> = {
      service: label,
      source: "dockerfile",
      framework: "dockerfile",
    };
    if (ports.length > 0) metadata.ports = [...new Set(ports)].join(",");
    facts.push({
      id: makeFactId(filePath, firstFromLine, "deploy-service"),
      kind: "deploy-service",
      filePath,
      line: firstFromLine,
      snippet: trimSnippet(
        `FROM ${(firstFromImage.split("@")[0] ?? firstFromImage).slice(0, 80)}`,
      ),
      metadata,
    });
  }

  return facts;
}

/** package.json dependencies → infra-service (SDK evidence, unused-ok). */
export function extractPackageJsonInfraFacts(
  filePath: string,
  content: string,
): CodeFact[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return [];
  }
  if (!parsed || typeof parsed !== "object") return [];
  const record = parsed as Record<string, unknown>;
  const buckets = [
    "dependencies",
    "devDependencies",
    "optionalDependencies",
    "peerDependencies",
  ];
  const seen = new Set<string>();
  const facts: CodeFact[] = [];

  for (const bucket of buckets) {
    const deps = record[bucket];
    if (!deps || typeof deps !== "object") continue;
    for (const pkg of Object.keys(deps as Record<string, unknown>)) {
      const service = packageToService(pkg);
      if (!service || seen.has(service)) continue;
      seen.add(service);
      // Approximate line: first occurrence of package name in file
      const lines = content.split("\n");
      let lineNum = 1;
      const needle = `"${pkg}"`;
      for (let i = 0; i < lines.length; i += 1) {
        if (lines[i]?.includes(needle)) {
          lineNum = i + 1;
          break;
        }
      }
      facts.push({
        id: makeFactId(filePath, lineNum, "infra-service"),
        kind: "infra-service",
        filePath,
        line: lineNum,
        snippet: trimSnippet(`"${pkg}": "***"`),
        metadata: {
          service,
          source: "package-sdk",
          framework: "npm",
          package: pkg.slice(0, MAX_NAME_LEN),
        },
      });
      if (facts.length >= MAX_SDK_SERVICES) return facts;
    }
  }
  return facts;
}

/**
 * Safe dotenv examples → infra-service from well-known *names* only.
 * Values are never stored; snippets are NAME=***.
 */
export function extractEnvExampleInfraFacts(
  filePath: string,
  content: string,
): CodeFact[] {
  const facts: CodeFact[] = [];
  const seenServices = new Set<string>();
  const names: string[] = [];
  const lines = content.split("\n");

  lines.forEach((line, index) => {
    const lineNum = index + 1;
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const match = trimmed.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/);
    if (!match) return;
    const name = match[1] ?? "";
    if (!isSafeEnvName(name)) return;
    if (names.length < MAX_ENV_NAMES) names.push(name);
    const service = envNameToService(name);
    if (!service || seenServices.has(service)) return;
    seenServices.add(service);
    facts.push({
      id: makeFactId(filePath, lineNum, "infra-service"),
      kind: "infra-service",
      filePath,
      line: lineNum,
      snippet: envNameSnippet(name),
      metadata: {
        service,
        source: "env-name",
        framework: "dotenv",
        // Keep a single representative name (not values)
        env: name.slice(0, MAX_NAME_LEN),
      },
    });
  });

  // Structural evidence: names present even when no engine mapped (for honest ABSENT vs NOT_DETECTED)
  if (names.length > 0 && facts.length === 0) {
    facts.push({
      id: makeFactId(filePath, 1, "deploy-service"),
      kind: "deploy-service",
      filePath,
      line: 1,
      snippet: envNameSnippet(names[0] ?? "ENV"),
      metadata: {
        service: "env-config",
        source: "env-name",
        framework: "dotenv",
        env: names.slice(0, 8).join(",").slice(0, MAX_NAME_LEN),
      },
    });
  }

  return facts;
}

export function extractTier1InfraFacts(
  filePath: string,
  content: string,
): CodeFact[] {
  if (isDockerfilePath(filePath)) {
    return extractDockerfileFacts(filePath, content);
  }
  if (isPackageJsonPath(filePath)) {
    return extractPackageJsonInfraFacts(filePath, content);
  }
  if (isSafeEnvExamplePath(filePath)) {
    return extractEnvExampleInfraFacts(filePath, content);
  }
  return [];
}

/** Shared image→service mapping for compose infra facts (MySQL/Mongo added). */
export function tier1ImageToService(image: string): string | null {
  return imageToService(image);
}
