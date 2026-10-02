/**
 * Pure ProjectCapabilities discovery from a relative path inventory (SDE-04).
 * No filesystem I/O — Local/Cloud adapters supply the inventory.
 * Location: shared/scan-detector/application/discover-project-capabilities.ts
 */

import {
  DISCOVERY_INVENTORY_ONLY_EXTENSIONS,
  DISCOVERY_SUPPORTED_EXTENSIONS,
  extensionOf,
} from "../domain/discovery-policy.js";
import type {
  DeploymentHint,
  DetectedDatastore,
  DetectedFramework,
  DetectedLanguage,
  DiscoveryFrameworkId,
  DiscoveryLanguageId,
  ProjectApplicationScope,
  ProjectCapabilities,
  UnsupportedSourceEntry,
} from "../domain/project-capabilities.js";

export interface DiscoveryPathEntry {
  /** Repo-relative POSIX path. */
  path: string;
  /** Optional byte size when known (oversized → inventory only). */
  sizeBytes?: number;
}

export interface DiscoverProjectCapabilitiesInput {
  projectId: string;
  paths: readonly DiscoveryPathEntry[];
  maxFileBytes?: number;
}

function normalizeRel(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\.\//, "").replace(/^\/+/, "");
}

function languageFromExtension(ext: string): DiscoveryLanguageId | null {
  switch (ext) {
    case "ts":
    case "tsx":
      return "typescript";
    case "js":
    case "jsx":
    case "mjs":
    case "cjs":
      return "javascript";
    case "py":
      return "python";
    case "go":
      return "go";
    case "rs":
      return "rust";
    case "java":
      return "java";
    default:
      return null;
  }
}

function detectApplicationRoot(path: string): string {
  const parts = normalizeRel(path).split("/").filter(Boolean);
  if (parts.length >= 2 && (parts[0] === "apps" || parts[0] === "packages" || parts[0] === "ee")) {
    return `${parts[0]}/${parts[1]}`;
  }
  return ".";
}

function applicationIdForRoot(rootPath: string): string {
  if (rootPath === ".") return "app:root";
  return `app:${rootPath}`;
}

function labelForRoot(rootPath: string): string {
  if (rootPath === ".") return "root";
  const parts = rootPath.split("/");
  return parts[parts.length - 1] || rootPath;
}

function inferFrameworks(path: string): DiscoveryFrameworkId[] {
  const normalized = normalizeRel(path).toLowerCase();
  const base = normalized.split("/").pop() ?? "";
  const found: DiscoveryFrameworkId[] = [];
  if (
    base === "next.config.js" ||
    base === "next.config.mjs" ||
    base === "next.config.ts" ||
    normalized.includes("/app/page.") ||
    normalized.includes("/pages/")
  ) {
    found.push("nextjs");
  }
  if (base === "vite.config.ts" || base === "vite.config.js" || normalized.includes("/react")) {
    found.push("react");
  }
  if (base.endsWith(".vue") || base === "nuxt.config.ts") found.push("vue");
  if (base === "manage.py" || normalized.includes("/django/") || base === "settings.py") {
    found.push("django");
  }
  if (base === "schema.prisma" || normalized.endsWith(".prisma")) found.push("prisma");
  if (base === "express.js" || normalized.includes("express")) found.push("express");
  return found;
}

function inferDatastore(path: string): DetectedDatastore | null {
  const normalized = normalizeRel(path).toLowerCase();
  const base = normalized.split("/").pop() ?? "";
  if (base === "schema.prisma" || normalized.endsWith(".prisma")) {
    return {
      id: `datastore:prisma:${normalizeRel(path)}`,
      label: "Prisma",
      kind: "prisma",
      evidencePaths: [normalizeRel(path)],
    };
  }
  if (normalized.endsWith(".sql")) {
    return {
      id: `datastore:sql:${normalizeRel(path)}`,
      label: "SQL",
      kind: "sql",
      evidencePaths: [normalizeRel(path)],
    };
  }
  if (/docker-compose|compose\./.test(base) || base === "compose.yaml" || base === "compose.yml") {
    // Compose often implies datastores; mark as other until service parse exists.
    return {
      id: `datastore:compose:${normalizeRel(path)}`,
      label: "Compose services",
      kind: "other",
      evidencePaths: [normalizeRel(path)],
    };
  }
  return null;
}

function inferDeployment(path: string): DeploymentHint | null {
  const normalized = normalizeRel(path);
  const base = (normalized.split("/").pop() ?? "").toLowerCase();
  if (
    base === "docker-compose.yml" ||
    base === "docker-compose.yaml" ||
    base === "compose.yml" ||
    base === "compose.yaml"
  ) {
    return { id: `deploy:compose:${normalized}`, kind: "docker-compose", path: normalized };
  }
  if (base === "dockerfile" || base.startsWith("dockerfile.")) {
    return { id: `deploy:docker:${normalized}`, kind: "dockerfile", path: normalized };
  }
  if (
    /(?:^|\/)(k8s|kubernetes|deploy|manifests)\//.test(normalized) &&
    (base.endsWith(".yml") || base.endsWith(".yaml"))
  ) {
    return { id: `deploy:k8s:${normalized}`, kind: "kubernetes", path: normalized };
  }
  return null;
}

function languageLabel(id: DiscoveryLanguageId): string {
  switch (id) {
    case "typescript":
      return "TypeScript";
    case "javascript":
      return "JavaScript";
    case "python":
      return "Python";
    case "go":
      return "Go";
    case "rust":
      return "Rust";
    case "java":
      return "Java";
    default:
      return "Unknown";
  }
}

function frameworkLabel(id: DiscoveryFrameworkId): string {
  switch (id) {
    case "nextjs":
      return "Next.js";
    case "react":
      return "React";
    case "vue":
      return "Vue";
    case "django":
      return "Django";
    case "express":
      return "Express";
    case "prisma":
      return "Prisma";
    default:
      return "Unknown";
  }
}

/**
 * Build ProjectCapabilities from a relative path inventory.
 */
export function discoverProjectCapabilities(
  input: DiscoverProjectCapabilitiesInput,
): ProjectCapabilities {
  const maxFileBytes = input.maxFileBytes ?? 512 * 1024;
  const languageEvidence = new Map<DiscoveryLanguageId, Set<string>>();
  const frameworkEvidence = new Map<
    DiscoveryFrameworkId,
    { paths: Set<string>; apps: Set<string> }
  >();
  const apps = new Map<string, ProjectApplicationScope>();
  const datastores = new Map<string, DetectedDatastore>();
  const deployments = new Map<string, DeploymentHint>();
  const unsupported: UnsupportedSourceEntry[] = [];

  for (const entry of input.paths) {
    const path = normalizeRel(entry.path);
    if (!path) continue;
    const ext = extensionOf(path);
    const appRoot = detectApplicationRoot(path);
    const appId = applicationIdForRoot(appRoot);

    if (!apps.has(appId)) {
      apps.set(appId, {
        id: appId,
        label: labelForRoot(appRoot),
        rootPath: appRoot,
        languageIds: [],
        frameworkIds: [],
      });
    }

    if (typeof entry.sizeBytes === "number" && entry.sizeBytes > maxFileBytes) {
      unsupported.push({ path, reason: "oversized" });
      continue;
    }

    const language = languageFromExtension(ext);
    if (language) {
      const bucket = languageEvidence.get(language) ?? new Set<string>();
      bucket.add(path);
      languageEvidence.set(language, bucket);
      const app = apps.get(appId)!;
      if (!app.languageIds.includes(language)) app.languageIds.push(language);
    } else if (DISCOVERY_INVENTORY_ONLY_EXTENSIONS.has(ext)) {
      unsupported.push({ path, reason: "unknown-language" });
    } else if (ext && !DISCOVERY_SUPPORTED_EXTENSIONS.has(ext)) {
      unsupported.push({ path, reason: "excluded-extension" });
    }

    for (const framework of inferFrameworks(path)) {
      const current = frameworkEvidence.get(framework) ?? {
        paths: new Set<string>(),
        apps: new Set<string>(),
      };
      current.paths.add(path);
      current.apps.add(appId);
      frameworkEvidence.set(framework, current);
      const app = apps.get(appId)!;
      if (!app.frameworkIds.includes(framework)) app.frameworkIds.push(framework);
    }

    const datastore = inferDatastore(path);
    if (datastore) datastores.set(datastore.id, datastore);

    const deployment = inferDeployment(path);
    if (deployment) deployments.set(deployment.id, deployment);
  }

  const languages: DetectedLanguage[] = [...languageEvidence.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([id, paths]) => ({
      id,
      label: languageLabel(id),
      status: "detected" as const,
      evidencePaths: [...paths].sort((a, b) => a.localeCompare(b)).slice(0, 24),
    }));

  if (unsupported.some((item) => item.reason === "unknown-language")) {
    languages.push({
      id: "unknown",
      label: languageLabel("unknown"),
      status: "unknown",
      evidencePaths: unsupported
        .filter((item) => item.reason === "unknown-language")
        .map((item) => item.path)
        .sort((a, b) => a.localeCompare(b))
        .slice(0, 24),
    });
  }

  const frameworks: DetectedFramework[] = [...frameworkEvidence.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([id, value]) => ({
      id,
      label: frameworkLabel(id),
      status: "detected" as const,
      applicationIds: [...value.apps].sort((a, b) => a.localeCompare(b)),
      evidencePaths: [...value.paths].sort((a, b) => a.localeCompare(b)).slice(0, 24),
    }));

  const detectorCapabilityIds = [
    ...new Set([
      ...languages.filter((item) => item.status === "detected").map((item) => `lang:${item.id}`),
      ...frameworks.map((item) => `framework:${item.id}`),
      ...[...datastores.values()].map((item) => `datastore:${item.kind}`),
      ...[...deployments.values()].map((item) => `deploy:${item.kind}`),
    ]),
  ].sort((a, b) => a.localeCompare(b));

  return {
    version: 1,
    projectId: input.projectId,
    applications: [...apps.values()].sort((left, right) => left.id.localeCompare(right.id)),
    languages,
    frameworks,
    datastores: [...datastores.values()].sort((left, right) => left.id.localeCompare(right.id)),
    deploymentHints: [...deployments.values()].sort((left, right) =>
      left.id.localeCompare(right.id),
    ),
    unsupportedSourceInventory: unsupported
      .slice()
      .sort((left, right) => left.path.localeCompare(right.path)),
    detectorCapabilityIds,
  };
}
