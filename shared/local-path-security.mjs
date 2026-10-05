/**
 * Shared path jail for local workspaces — absolute paths only, under allowed roots.
 * Location: shared/local-path-security.mjs
 * Used by: preview-runner, local-engine
 *
 * Default roots (when VISUDEV_ALLOWED_LOCAL_ROOTS unset): ~/.visudev and common
 * project folders under $HOME — not the entire home directory.
 */

import { existsSync, realpathSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";

function defaultAllowedRootCandidates() {
  const home = homedir();
  return [
    join(home, ".visudev"),
    join(home, "Projects"),
    join(home, "Developer"),
    join(home, "repos"),
    join(home, "code"),
    join(home, "src"),
    join(home, "Desktop"),
    join(home, "Documents"),
  ];
}

function resolveAllowedRoots() {
  const raw = process.env.VISUDEV_ALLOWED_LOCAL_ROOTS?.trim();
  const candidates = raw ? raw.split(",") : defaultAllowedRootCandidates();
  const roots = [];
  for (const entry of candidates) {
    const trimmed = entry.trim();
    if (!trimmed) continue;
    try {
      const absolute = resolve(trimmed);
      if (!existsSync(absolute)) continue;
      roots.push(realpathSync(absolute));
    } catch (error) {
      const message = error instanceof Error ? error.message : "read failed";
      console.warn("[local-path-security] skip invalid root:", message);
    }
  }
  // Explicit VISUDEV_ALLOWED_LOCAL_ROOTS stays fail-closed. Unset defaults may miss
  // ~/Projects etc. on CI/minimal hosts — fall back to $HOME only then.
  if (roots.length === 0 && !raw) {
    try {
      const home = homedir();
      if (existsSync(home)) roots.push(realpathSync(home));
    } catch (error) {
      const message = error instanceof Error ? error.message : "read failed";
      console.warn("[local-path-security] home fallback failed:", message);
    }
  }
  return roots;
}

function isUnderRoot(resolvedPath, root) {
  return resolvedPath === root || resolvedPath.startsWith(`${root}/`);
}

/**
 * @param {unknown} rawPath
 * @returns {{ ok: true, path: string } | { ok: false, error: string }}
 */
export function resolveValidatedLocalPath(rawPath) {
  const trimmed = String(rawPath ?? "").trim();
  if (!trimmed) {
    return { ok: false, error: "localPath is required" };
  }
  if (!isAbsolute(trimmed)) {
    return { ok: false, error: "localPath must be an absolute path" };
  }
  if (trimmed.includes("\0")) {
    return { ok: false, error: "Invalid localPath" };
  }

  let resolved;
  try {
    if (!existsSync(trimmed)) {
      return { ok: false, error: "localPath does not exist" };
    }
    resolved = realpathSync(trimmed);
  } catch {
    return { ok: false, error: "localPath is not accessible" };
  }

  let stat;
  try {
    stat = statSync(resolved);
  } catch {
    return { ok: false, error: "localPath is not accessible" };
  }
  if (!stat.isDirectory()) {
    return { ok: false, error: "localPath must be a directory" };
  }

  const allowedRoots = resolveAllowedRoots();
  if (allowedRoots.length === 0) {
    return {
      ok: false,
      error:
        "No allowed local path roots configured. Set VISUDEV_ALLOWED_LOCAL_ROOTS to a comma-separated list of absolute directories.",
    };
  }
  const permitted = allowedRoots.some((root) => isUnderRoot(resolved, root));
  if (!permitted) {
    return { ok: false, error: "localPath is outside allowed roots" };
  }

  return { ok: true, path: resolved };
}
