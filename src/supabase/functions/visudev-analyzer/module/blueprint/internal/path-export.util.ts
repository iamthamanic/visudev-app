/** Repo-relative / capped path helpers for Blueprint export (UI-safe samples). */

export const MAX_EXPORT_SAMPLE_PATH_LEN = 200;
export const MAX_PATH_CATALOG = 4000;
export const MAX_PATH_CATALOG_ENTRY_LEN = 512;

/** Prefer cutting absolute paths at these markers so usernames never remain. */
const REPO_PATH_MARKERS = [
  "/src/",
  "/apps/",
  "/packages/",
  "/backend/",
  "/erpnext/",
  "/server/",
  "/local-engine/",
  "/frontend/",
  "/supabase/",
  "/preview-runner/",
] as const;

/**
 * Collapse an absolute filesystem path to a repo-ish relative sample.
 * Prefer repo markers first so legitimate dirs named `home`/`Users` stay intact.
 * Only strip OS home pairs (`Users/<name>`, `home/<name>`) at root or after
 * volume-ish parents (tmp/var/…), never mid-project `src/home/...`.
 */
function stripAbsoluteHostPath(absolutePath: string): string {
  const tryMarkers = (parts: string[]): string | null => {
    const joined = `/${parts.join("/")}`;
    const lower = joined.toLowerCase();
    for (const marker of REPO_PATH_MARKERS) {
      const idx = lower.indexOf(marker);
      if (idx >= 0) return joined.slice(idx + 1);
    }
    return null;
  };

  let parts = absolutePath.split("/").filter(Boolean);
  const markedEarly = tryMarkers(parts);
  if (markedEarly) return markedEarly;

  const volumeish = new Set([
    "tmp",
    "var",
    "private",
    "Volumes",
    "mnt",
    "media",
  ]);
  const rootedOnVolume = parts.length > 0 && volumeish.has(parts[0]!);
  for (let i = 0; i < parts.length - 1; i += 1) {
    const head = parts[i]!;
    if (
      (head === "Users" || head === "home") &&
      (i === 0 || rootedOnVolume || volumeish.has(parts[i - 1]!))
    ) {
      parts = parts.slice(i + 2);
      i = -1;
    }
  }

  const markedLate = tryMarkers(parts);
  if (markedLate) return markedLate;

  return parts.slice(-4).join("/");
}

/**
 * Strip absolute host prefixes so failedSamples / catalogs never leak local
 * filesystem roots into the Blueprint document that reaches the UI.
 */
export function toExportSamplePath(
  filePath: string,
  rootHint?: string,
  maxLen: number = MAX_EXPORT_SAMPLE_PATH_LEN,
): string {
  let next = String(filePath ?? "").trim().replace(/\\/g, "/");
  if (!next) return "";

  const root = String(rootHint ?? "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/\/+$/, "");
  if (root) {
    const rootLower = root.toLowerCase();
    const nextLower = next.toLowerCase();
    if (nextLower === rootLower) return ".";
    if (nextLower.startsWith(`${rootLower}/`)) {
      next = next.slice(root.length + 1);
    }
  }

  // Windows drive letter (C: or C:/)
  next = next.replace(/^[A-Za-z]:\/?/, "");

  // After drive strip, Unix-style homes may lack a leading slash (C:Users/...).
  if (!next.startsWith("/") && /^(?:Users|home)\//i.test(next)) {
    next = `/${next}`;
  }

  if (next.startsWith("/")) {
    next = stripAbsoluteHostPath(next);
  }

  // Defense: if a home prefix somehow remained after relativization, drop it.
  const homeLeak = next.match(/^(?:Users|home)\/[^/]+\/(.*)$/i);
  if (homeLeak?.[1]) {
    next = homeLeak[1];
  }

  if (next.length > maxLen) {
    next = next.slice(next.length - maxLen);
    const slash = next.indexOf("/");
    if (slash > 0 && slash < 40) next = next.slice(slash + 1);
  }

  return next;
}

/** Round-robin by first two path segments so domain trees are not starved. */
export function selectDiversePaths(
  paths: readonly string[],
  limit: number,
): string[] {
  const cap = Math.max(0, limit);
  if (cap === 0 || paths.length === 0) return [];
  if (paths.length <= cap) {
    return [...new Set(paths.map((p) => p.replace(/\\/g, "/")))];
  }

  const buckets = new Map<string, string[]>();
  const order: string[] = [];
  for (const raw of paths) {
    const path = raw.replace(/\\/g, "/").trim();
    if (!path) continue;
    const parts = path.split("/").filter(Boolean);
    const key = parts.slice(0, Math.min(2, parts.length)).join("/") || "_";
    if (!buckets.has(key)) {
      buckets.set(key, []);
      order.push(key);
    }
    buckets.get(key)!.push(path);
  }

  const selected: string[] = [];
  const seen = new Set<string>();
  const indexes = new Map<string, number>();
  for (const key of order) indexes.set(key, 0);

  let progress = true;
  while (selected.length < cap && progress) {
    progress = false;
    for (const key of order) {
      if (selected.length >= cap) break;
      const list = buckets.get(key)!;
      let idx = indexes.get(key) ?? 0;
      while (idx < list.length && seen.has(list[idx]!)) idx += 1;
      if (idx >= list.length) {
        indexes.set(key, idx);
        continue;
      }
      const pick = list[idx]!;
      seen.add(pick);
      selected.push(pick);
      indexes.set(key, idx + 1);
      progress = true;
    }
  }

  return selected;
}

export function sanitizePathCatalog(
  paths: readonly string[],
  rootHint?: string,
  limit: number = MAX_PATH_CATALOG,
): string[] {
  const normalized = paths
    .map((p) => toExportSamplePath(p, rootHint, MAX_PATH_CATALOG_ENTRY_LEN))
    .filter((p) => p.length > 0 && p !== ".");
  return selectDiversePaths(normalized, limit);
}
