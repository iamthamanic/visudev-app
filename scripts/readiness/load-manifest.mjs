/**
 * Load and validate the Product Readiness golden-projects manifest (#375).
 * Location: scripts/readiness/load-manifest.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SHA_RE = /^[0-9a-f]{40}$/i;
const EXPECTED_IDS = [
  "hrkoordinator",
  "sagadrive",
  "scriptony-multihost",
  "hv123-mobile-haba",
  "screenator",
];

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_MANIFEST_PATH = path.resolve(
  __dirname,
  "../../.qa/readiness/golden-projects.manifest.json",
);

/**
 * @typedef {"required" | "optional"} CapabilityRequirement
 * @typedef {"PASS" | "FAIL" | "UNAVAILABLE" | "SKIPPED"} CapabilityStatus
 */

/**
 * @param {string} [manifestPath]
 */
export function loadReadinessManifest(manifestPath = DEFAULT_MANIFEST_PATH) {
  const absolute = path.resolve(manifestPath);
  if (!fs.existsSync(absolute)) {
    throw new Error(`Readiness manifest missing: ${absolute}`);
  }
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(absolute, "utf8"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Readiness manifest is not valid JSON (${absolute}): ${message}`);
  }
  validateManifest(raw, absolute);
  return normalizeManifest(raw);
}

/**
 * @param {unknown} raw
 * @param {string} absolute
 */
export function validateManifest(raw, absolute = "<memory>") {
  if (!raw || typeof raw !== "object") {
    throw new Error(`Invalid readiness manifest (not an object): ${absolute}`);
  }
  const doc = /** @type {Record<string, unknown>} */ (raw);
  if (doc.version !== 1) {
    throw new Error(`Unsupported readiness manifest version: ${String(doc.version)}`);
  }
  if (!Array.isArray(doc.projects) || doc.projects.length !== 5) {
    throw new Error(
      `Readiness manifest must list exactly 5 golden projects (got ${
        Array.isArray(doc.projects) ? doc.projects.length : 0
      })`,
    );
  }

  const ids = doc.projects.map((project) => {
    if (!project || typeof project !== "object") {
      throw new Error("Each project entry must be an object");
    }
    const entry = /** @type {Record<string, unknown>} */ (project);
    if (typeof entry.id !== "string" || !entry.id) {
      throw new Error("Project entry missing id");
    }
    validateSource(entry.id, entry.source);
    return entry.id;
  });

  for (const expected of EXPECTED_IDS) {
    if (!ids.includes(expected)) {
      throw new Error(`Readiness manifest missing golden project id: ${expected}`);
    }
  }
  if (new Set(ids).size !== ids.length) {
    throw new Error("Readiness manifest contains duplicate project ids");
  }
}

/**
 * @param {string} id
 * @param {unknown} source
 */
function validateSource(id, source) {
  if (!source || typeof source !== "object") {
    throw new Error(`Project ${id}: source is required`);
  }
  const src = /** @type {Record<string, unknown>} */ (source);
  if (src.kind === "github") {
    if (typeof src.owner !== "string" || typeof src.repo !== "string") {
      throw new Error(`Project ${id}: github source requires owner/repo`);
    }
    if (typeof src.commitSha !== "string" || !SHA_RE.test(src.commitSha)) {
      throw new Error(`Project ${id}: github source requires full 40-char commitSha pin`);
    }
    if (src.localProjectKey || src.pathEnv) {
      throw new Error(`Project ${id}: github source must not set local identity fields`);
    }
    return;
  }
  if (src.kind === "local") {
    if (typeof src.localProjectKey !== "string" || !src.localProjectKey) {
      throw new Error(`Project ${id}: local source requires localProjectKey`);
    }
    if (typeof src.pathEnv !== "string" || !src.pathEnv) {
      throw new Error(`Project ${id}: local source requires pathEnv`);
    }
    if (src.owner || src.repo || src.commitSha || src.repositoryUrl) {
      throw new Error(
        `Project ${id}: local source must not invent a GitHub remote (owner/repo/sha/url)`,
      );
    }
    return;
  }
  throw new Error(`Project ${id}: source.kind must be github|local`);
}

/**
 * @param {Record<string, unknown>} raw
 */
function normalizeManifest(raw) {
  const defaults =
    raw.defaultCapabilities && typeof raw.defaultCapabilities === "object"
      ? /** @type {Record<string, CapabilityRequirement>} */ (raw.defaultCapabilities)
      : {};
  const capabilityKeys = Array.isArray(raw.capabilityKeys)
    ? raw.capabilityKeys.map(String)
    : Object.keys(defaults);

  const projects = /** @type {Array<Record<string, unknown>>} */ (raw.projects).map((project) => {
    const overrides =
      project.capabilities && typeof project.capabilities === "object"
        ? /** @type {Record<string, CapabilityRequirement>} */ (project.capabilities)
        : {};
    const capabilities = {};
    for (const key of capabilityKeys) {
      capabilities[key] = overrides[key] || defaults[key] || "optional";
    }
    return {
      ...project,
      capabilities,
      runtimeExploration: project.runtimeExploration || "optional",
      gate: {
        mode: "resolve",
        sourceRequiredInCi: true,
        captureViews: false,
        ...(project.gate && typeof project.gate === "object" ? project.gate : {}),
      },
    };
  });

  return {
    version: 1,
    epic: raw.epic ?? null,
    harnessIssue: raw.harnessIssue ?? null,
    capabilityKeys,
    defaultCapabilities: defaults,
    projects,
    manifestPath: DEFAULT_MANIFEST_PATH,
  };
}

/**
 * @param {ReturnType<typeof loadReadinessManifest>} manifest
 * @param {string} projectId
 */
export function getProject(manifest, projectId) {
  const project = manifest.projects.find((entry) => entry.id === projectId);
  if (!project) {
    throw new Error(`Unknown readiness project id: ${projectId}`);
  }
  return project;
}

export { EXPECTED_IDS, SHA_RE };
