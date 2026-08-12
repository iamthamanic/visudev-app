# P0-9 — Null Import-/Aufruf-Kanten

## Intent

Preserve `resolvedPath`/`targetFile` through metadata sanitization, resolve NodeNext `.js`→`.ts` imports, and surface AST parse failures so SoftwareGraph gets real `imports`/`calls` edges.

## Acceptance

- Allowlist includes `resolvedpath` and `targetfile` (normalized); path-like values use MAX_PATH_STRING_LEN=512 and are not length-redacted to `***`.
- `resolveImport` prefers exact file match, then JS→TS rewrite; EXTENSIONS include mts/cts and index variants.
- Blueprint export includes `astParseReport` with filesAttempted/filesParsed/filesFailed/failedSamples.
- Unit tests cover resolver, sanitizer, and parse-failure reporting.
- Golden-set metric `importEdges` has a fixture-appropriate min.
- `MAX_FILES` in call-graph.builder.ts unchanged.
