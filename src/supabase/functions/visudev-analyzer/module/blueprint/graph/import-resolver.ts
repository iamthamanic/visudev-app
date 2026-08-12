/** Resolves relative TS/JS imports to repo-relative file paths. */

const EXTENSIONS = [
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mts",
  ".cts",
  "/index.ts",
  "/index.tsx",
  "/index.js",
  "/index.jsx",
];

/** TypeScript NodeNext writes `./x.js` for a file that is actually `./x.ts`. */
const JS_TO_TS_REWRITE: ReadonlyArray<[RegExp, readonly string[]]> = [
  [/\.js$/, [".ts", ".tsx"]],
  [/\.jsx$/, [".tsx"]],
  [/\.mjs$/, [".mts"]],
  [/\.cjs$/, [".cts"]],
];

export function extractImports(
  content: string,
  filePath: string,
  knownPaths?: ReadonlySet<string>,
): Array<{ specifier: string; resolvedPath: string | null }> {
  const results: Array<{ specifier: string; resolvedPath: string | null }> = [];
  const importRegex =
    /import\s+(?:type\s+)?(?:[\w*\s{},]+)\s+from\s+["']([^"']+)["']/g;
  let match: RegExpExecArray | null;
  while ((match = importRegex.exec(content)) !== null) {
    const specifier = match[1];
    results.push({
      specifier,
      resolvedPath: resolveImport(specifier, filePath, knownPaths),
    });
  }
  return results;
}

export function resolveImport(
  specifier: string,
  fromFile: string,
  knownPaths?: ReadonlySet<string>,
): string | null {
  if (!specifier.startsWith(".") && !specifier.startsWith("/")) {
    return null;
  }

  const dir = fromFile.includes("/")
    ? fromFile.slice(0, fromFile.lastIndexOf("/"))
    : "";
  const base = normalizePath(
    specifier.startsWith("/") ? specifier.slice(1) : joinPath(dir, specifier),
  );

  const candidates: string[] = [];
  // 1) base + known extensions (covers extensionless and directory index forms)
  for (const ext of EXTENSIONS) {
    candidates.push(ext.startsWith("/") ? `${base}${ext}` : `${base}${ext}`);
  }
  // 2) exact base — must win over JS→TS rewrite when both .js and .ts exist
  candidates.push(base);
  // 3) NodeNext .js/.mjs/.cjs → real TS sources (and index under stem)
  for (const [pattern, replacements] of JS_TO_TS_REWRITE) {
    if (!pattern.test(base)) continue;
    for (const replacement of replacements) {
      candidates.push(base.replace(pattern, replacement));
    }
    const stem = base.replace(pattern, "");
    for (const replacement of replacements) {
      candidates.push(`${stem}/index${replacement}`);
    }
  }

  if (knownPaths) {
    for (const candidate of candidates) {
      if (knownPaths.has(candidate)) return candidate;
    }
    return null;
  }

  return candidates[0] ?? null;
}

function joinPath(dir: string, rel: string): string {
  const parts = [...dir.split("/"), ...rel.split("/")].filter(Boolean);
  const stack: string[] = [];
  for (const part of parts) {
    if (part === "..") stack.pop();
    else if (part !== ".") stack.push(part);
  }
  return stack.join("/");
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/\/+/g, "/");
}
