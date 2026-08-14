/**
 * Indent-based Compose / Kubernetes descriptor parser (no YAML eval).
 * Location: src/supabase/functions/visudev-analyzer/module/blueprint/facts/compose-k8s-descriptors.ts
 */

export type DeployDescriptorSource = "docker-compose" | "kubernetes";

export interface ParsedDeployService {
  name: string;
  line: number;
  snippet: string;
  source: DeployDescriptorSource;
  env?: string;
  region?: string;
  ports: string[];
  networks: string[];
  dependsOn: string[];
}

/** Per-file budget (same order of magnitude as other fact extractors). */
export const MAX_SERVICES_PER_FILE = 40;
const MAX_NAME_LEN = 64;
const MAX_LIST_ITEMS = 16;
const REGION_LABEL_KEYS = new Set([
  "topology.kubernetes.io/region",
  "failure-domain.beta.kubernetes.io/region",
  "com.visudev.region",
]);
const K8S_KINDS = new Set([
  "Deployment",
  "StatefulSet",
  "DaemonSet",
  "Service",
]);

export function isComposeDescriptorPath(filePath: string): boolean {
  const path = filePath.replace(/\\/g, "/").toLowerCase();
  return (
    /(?:^|\/)docker-compose[^/]*\.(ya?ml)$/.test(path) ||
    /(?:^|\/)compose\.(ya?ml)$/.test(path)
  );
}

export function isK8sDescriptorPath(filePath: string): boolean {
  const path = filePath.replace(/\\/g, "/").toLowerCase();
  if (!/\.ya?ml$/.test(path)) return false;
  if (isComposeDescriptorPath(path)) return false;
  if (/(?:^|\/)(k8s|kubernetes|manifests)\//.test(path)) return true;
  return /(?:^|\/)(deployment|deployments|service|services|statefulset|daemonset)s?\.(ya?ml)$/
    .test(path);
}

export function isYamlDescriptorPath(filePath: string): boolean {
  return isComposeDescriptorPath(filePath) || isK8sDescriptorPath(filePath);
}

function looksLikeHelmTemplate(content: string): boolean {
  return content.includes("{{") && content.includes("}}");
}

function warnIfTruncated(
  filePath: string,
  kept: number,
  dropped: number,
): void {
  if (dropped <= 0) return;
  console.warn(
    `[blueprint] compose/k8s descriptor truncated: ${filePath} kept ${kept} services, dropped ${dropped}`,
  );
}

function unquote(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length >= 2) {
    const start = trimmed[0];
    const end = trimmed[trimmed.length - 1];
    if ((start === '"' && end === '"') || (start === "'" && end === "'")) {
      return trimmed.slice(1, -1);
    }
  }
  return trimmed;
}

function stripInlineComment(line: string): string {
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === "'" && !inDouble) inSingle = !inSingle;
    else if (char === '"' && !inSingle) inDouble = !inDouble;
    else if (char === "#" && !inSingle && !inDouble) {
      return line.slice(0, i).trimEnd();
    }
  }
  return line;
}

function indentOf(line: string): number {
  const match = line.match(/^[ ]*/);
  return match ? match[0].length : 0;
}

function normalizeNewlines(content: string): string {
  return content.replace(/\r\n/g, "\n").replace(/\t/g, "  ");
}

function sanitizeName(raw: string): string | null {
  const name = unquote(raw).trim();
  if (!name || name.length > MAX_NAME_LEN) return null;
  if (!/^[A-Za-z0-9._-]+$/.test(name)) return null;
  return name;
}

function sanitizePort(raw: string): string | null {
  const token = unquote(raw).trim();
  const mapped = token.match(/(?:^|:)(\d{1,5}):(\d{1,5})(?:\/(?:tcp|udp))?$/i);
  if (mapped) return `${mapped[1]}:${mapped[2]}`;
  const single = token.match(/^(\d{1,5})(?:\/(?:tcp|udp))?$/i);
  return single ? single[1] : null;
}

function uniqueCap(values: string[], max = MAX_LIST_ITEMS): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    if (seen.has(value) || out.length >= max) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

function parseKeyValue(line: string): { key: string; value: string } | null {
  const trimmed = stripInlineComment(line).trim();
  const colon = trimmed.indexOf(":");
  if (colon <= 0) return null;
  const key = trimmed.slice(0, colon).trim();
  if (!/^[A-Za-z0-9._/@-]+$/.test(key)) return null;
  return { key, value: unquote(trimmed.slice(colon + 1)) };
}

function parseDashItem(line: string): string | null {
  const trimmed = stripInlineComment(line).trim();
  if (!trimmed.startsWith("- ")) return null;
  return unquote(trimmed.slice(2));
}

function envFromComposePath(filePath: string): string | undefined {
  const base = (filePath.replace(/\\/g, "/").split("/").pop() ?? "")
    .toLowerCase();
  const match = base.match(/^docker-compose[.-]([a-z0-9._-]+)\.ya?ml$/) ||
    base.match(/^compose[.-]([a-z0-9._-]+)\.ya?ml$/);
  if (!match) return undefined;
  const env = match[1];
  if (env === "yml" || env === "yaml") return undefined;
  return env;
}

function regionFromLabel(key: string, value: string): string | undefined {
  if (!REGION_LABEL_KEYS.has(key)) return undefined;
  return sanitizeName(value) ?? undefined;
}

export function parseComposeDeployServices(
  filePath: string,
  content: string,
): ParsedDeployService[] {
  if (looksLikeHelmTemplate(content)) return [];
  const lines = normalizeNewlines(content).split("\n");
  let projectName: string | undefined;
  let inServices = false;
  let servicesIndent = -1;
  let serviceIndent = -1;
  let current: ParsedDeployService | null = null;
  let field: "ports" | "networks" | "depends_on" | "labels" | null = null;
  let fieldIndent = -1;
  let fieldItemIndent = -1;
  let dropped = 0;
  const services: ParsedDeployService[] = [];

  const flush = (): void => {
    if (!current) return;
    current.ports = uniqueCap(current.ports);
    current.networks = uniqueCap(current.networks);
    current.dependsOn = uniqueCap(current.dependsOn);
    services.push(current);
    current = null;
    field = null;
  };

  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index] ?? "";
    const stripped = stripInlineComment(raw);
    if (!stripped.trim()) continue;
    const indent = indentOf(stripped);
    const kv = parseKeyValue(stripped);
    const dash = parseDashItem(stripped);

    if (!inServices) {
      if (kv?.key === "name" && indent === 0 && kv.value) {
        projectName = sanitizeName(kv.value) ?? projectName;
      }
      if (kv?.key === "services" && !kv.value) {
        inServices = true;
        servicesIndent = indent;
      }
      continue;
    }

    if (indent <= servicesIndent) {
      flush();
      inServices = false;
      index -= 1;
      continue;
    }

    if (serviceIndent < 0 && kv && !kv.value) {
      serviceIndent = indent;
    }

    if (kv && indent === serviceIndent && !kv.value) {
      const name = sanitizeName(kv.key);
      flush();
      if (services.length >= MAX_SERVICES_PER_FILE) {
        if (name) dropped += 1;
        continue;
      }
      if (!name) continue;
      current = {
        name,
        line: index + 1,
        snippet: stripped.trim().slice(0, 120),
        source: "docker-compose",
        env: envFromComposePath(filePath) ?? projectName,
        ports: [],
        networks: [],
        dependsOn: [],
      };
      field = null;
      continue;
    }

    if (!current || indent <= serviceIndent) continue;

    if (
      kv && indent > serviceIndent && (field === null || indent <= fieldIndent)
    ) {
      if (
        kv.key === "ports" || kv.key === "networks" ||
        kv.key === "depends_on" ||
        kv.key === "labels"
      ) {
        field = kv.key;
        fieldIndent = indent;
        fieldItemIndent = -1;
        if (kv.key === "ports" && kv.value) {
          const port = sanitizePort(
            kv.value.replace(/^\[/, "").replace(/\]$/, ""),
          );
          if (port) current.ports.push(port);
        }
        continue;
      }
      field = null;
    }

    if (!field) continue;

    if (field === "ports") {
      if (dash) {
        const inline = parseKeyValue(dash);
        if (
          inline?.key === "published" || inline?.key === "target" ||
          inline?.key === "port"
        ) {
          const port = sanitizePort(inline.value);
          if (port) current.ports.push(port);
        } else {
          const port = sanitizePort(dash);
          if (port) current.ports.push(port);
        }
      } else if (
        kv &&
        (kv.key === "published" || kv.key === "target" || kv.key === "port")
      ) {
        const port = sanitizePort(kv.value);
        if (port) current.ports.push(port);
      }
    } else if (field === "networks" || field === "depends_on") {
      const bucket = field === "networks"
        ? current.networks
        : current.dependsOn;
      if (dash) {
        if (fieldItemIndent < 0) fieldItemIndent = indent;
        if (indent !== fieldItemIndent) continue;
        const name = sanitizeName(dash.split(":")[0] ?? dash);
        if (name) bucket.push(name);
      } else if (kv && indent > fieldIndent) {
        if (fieldItemIndent < 0) fieldItemIndent = indent;
        if (indent !== fieldItemIndent) continue;
        const name = sanitizeName(kv.key);
        if (name) bucket.push(name);
      }
    } else if (field === "labels") {
      if (dash) {
        const eq = dash.indexOf("=");
        if (eq > 0) {
          const region = regionFromLabel(
            dash.slice(0, eq).trim(),
            dash.slice(eq + 1),
          );
          if (region) current.region = region;
        }
      } else if (kv) {
        const region = regionFromLabel(kv.key, kv.value);
        if (region) current.region = region;
      }
    }
  }
  flush();
  warnIfTruncated(filePath, services.length, dropped);
  return services;
}

interface K8sResource {
  kind: string;
  name: string;
  namespace?: string;
  region?: string;
  ports: string[];
  line: number;
  snippet: string;
}

function parseK8sDocument(doc: string, startLine: number): K8sResource | null {
  if (looksLikeHelmTemplate(doc)) return null;
  const lines = doc.split("\n");
  let kind = "";
  let name = "";
  let namespace: string | undefined;
  let region: string | undefined;
  const ports: string[] = [];
  let kindLine = startLine;
  const stack: Array<{ key: string; indent: number }> = [];

  const pathKeys = (): string[] => stack.map((frame) => frame.key);

  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index] ?? "";
    const stripped = stripInlineComment(raw);
    if (!stripped.trim()) continue;
    const indent = indentOf(stripped);
    while (stack.length > 0 && stack[stack.length - 1]!.indent >= indent) {
      stack.pop();
    }
    const dash = parseDashItem(stripped);
    const kv = dash ? parseKeyValue(dash) : parseKeyValue(stripped);
    if (!kv) continue;
    if (!dash) stack.push({ key: kv.key, indent });
    const path = pathKeys().join(".");
    const inLabelsOrSelector = stack.some(
      (frame) => frame.key === "labels" || frame.key === "nodeSelector",
    );
    if (path === "kind" && K8S_KINDS.has(kv.value)) {
      kind = kv.value;
      kindLine = startLine + index;
    } else if (path === "metadata.name") {
      name = sanitizeName(kv.value) ?? name;
    } else if (path === "metadata.namespace") {
      namespace = sanitizeName(kv.value) ?? namespace;
    } else if (inLabelsOrSelector) {
      region = regionFromLabel(kv.key, kv.value) ?? region;
    } else if (
      (kv.key === "port" || kv.key === "containerPort" ||
        kv.key === "targetPort") &&
      /^\d{1,5}$/.test(kv.value)
    ) {
      const port = sanitizePort(kv.value);
      if (port) ports.push(port);
    }
  }

  if (!kind || !name) return null;
  return {
    kind,
    name,
    namespace,
    region,
    ports: uniqueCap(ports),
    line: kindLine,
    snippet: `kind: ${kind}`,
  };
}

export function parseK8sDeployServices(
  filePath: string,
  content: string,
): ParsedDeployService[] {
  if (looksLikeHelmTemplate(content)) return [];
  const normalized = normalizeNewlines(content);
  const docs: Array<{ text: string; startLine: number }> = [];
  let current = "";
  let startLine = 1;
  const lines = normalized.split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (/^---\s*$/.test(line)) {
      if (current.trim()) docs.push({ text: current, startLine });
      current = "";
      startLine = index + 2;
      continue;
    }
    current += `${line}\n`;
  }
  if (current.trim()) docs.push({ text: current, startLine });

  const merged = new Map<string, ParsedDeployService>();
  let dropped = 0;
  for (const doc of docs) {
    const resource = parseK8sDocument(doc.text, doc.startLine);
    if (!resource) continue;
    const key = `${resource.namespace ?? ""}/${resource.name}`;
    const existing = merged.get(key);
    if (existing) {
      existing.ports = uniqueCap([...existing.ports, ...resource.ports]);
      existing.region = existing.region ?? resource.region;
      continue;
    }
    if (merged.size >= MAX_SERVICES_PER_FILE) {
      dropped += 1;
      continue;
    }
    merged.set(key, {
      name: resource.name,
      line: resource.line,
      snippet: resource.snippet,
      source: "kubernetes",
      env: resource.namespace,
      region: resource.region,
      ports: resource.ports,
      networks: [],
      dependsOn: [],
    });
  }
  const services = [...merged.values()];
  warnIfTruncated(filePath, services.length, dropped);
  return services;
}

export function parseDeployDescriptors(
  filePath: string,
  content: string,
): ParsedDeployService[] {
  if (isComposeDescriptorPath(filePath)) {
    return parseComposeDeployServices(filePath, content);
  }
  if (isK8sDescriptorPath(filePath)) {
    return parseK8sDeployServices(filePath, content);
  }
  return [];
}
