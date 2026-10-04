/**
 * Resolve source identity for one golden project (GitHub pin or local HABA contract).
 * Location: scripts/readiness/resolve-project.mjs
 */

import fs from "node:fs";
import path from "node:path";

/**
 * @param {Record<string, unknown>} project
 * @param {NodeJS.ProcessEnv} [env]
 */
export function resolveProjectSource(project, env = process.env) {
  const source = /** @type {Record<string, unknown>} */ (project.source);
  if (source.kind === "github") {
    const owner = String(source.owner);
    const repo = String(source.repo);
    const commitSha = String(source.commitSha).toLowerCase();
    const repositoryUrl =
      typeof source.repositoryUrl === "string"
        ? source.repositoryUrl
        : `https://github.com/${owner}/${repo}`;
    // CI may fail to clone private golden repos without VISUDEV_READINESS_GH_TOKEN.
    const checkoutFlag = env.VISUDEV_READINESS_CHECKOUT_OK;
    if (checkoutFlag === "false" || checkoutFlag === "0") {
      return {
        available: false,
        kind: "github",
        owner,
        repo,
        commitSha,
        repositoryUrl,
        localPath: null,
        reason: "github checkout unavailable in this environment (private repo or missing token)",
      };
    }
    return {
      available: true,
      kind: "github",
      owner,
      repo,
      commitSha,
      repositoryUrl,
      localPath: null,
      reason: "pinned github commit",
    };
  }

  if (source.kind === "local") {
    const pathEnv = String(source.pathEnv);
    const localProjectKey = String(source.localProjectKey);
    const rawPath = env[pathEnv];
    if (!rawPath || !String(rawPath).trim()) {
      return {
        available: false,
        kind: "local",
        localProjectKey,
        pathEnv,
        localPath: null,
        repositoryUrl: null,
        reason: `${pathEnv} unset — local dogfood source UNAVAILABLE`,
      };
    }
    const localPath = path.resolve(String(rawPath).trim());
    if (!fs.existsSync(localPath) || !fs.statSync(localPath).isDirectory()) {
      return {
        available: false,
        kind: "local",
        localProjectKey,
        pathEnv,
        localPath,
        repositoryUrl: null,
        reason: `path does not exist or is not a directory: ${localPath}`,
      };
    }
    const basename = path.basename(localPath);
    const accepted = Array.isArray(source.acceptedPathBasenames)
      ? source.acceptedPathBasenames.map((item) => String(item).toLowerCase())
      : [localProjectKey.toLowerCase()];
    if (!accepted.includes(basename.toLowerCase())) {
      return {
        available: false,
        kind: "local",
        localProjectKey,
        pathEnv,
        localPath,
        repositoryUrl: null,
        reason: `basename "${basename}" not in accepted local identity list`,
      };
    }
    const markers = Array.isArray(source.markerFiles)
      ? source.markerFiles.map(String)
      : ["package.json"];
    const foundMarker = markers.find((marker) => fs.existsSync(path.join(localPath, marker)));
    if (!foundMarker) {
      return {
        available: false,
        kind: "local",
        localProjectKey,
        pathEnv,
        localPath,
        repositoryUrl: null,
        reason: `no marker file present (${markers.join(", ")})`,
      };
    }
    return {
      available: true,
      kind: "local",
      localProjectKey,
      pathEnv,
      localPath,
      markerFile: foundMarker,
      repositoryUrl: null,
      reason: "local identity contract satisfied",
    };
  }

  return {
    available: false,
    kind: "unknown",
    localPath: null,
    repositoryUrl: null,
    reason: `unsupported source.kind`,
  };
}
