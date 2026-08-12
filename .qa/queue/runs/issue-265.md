# Issue #265 — P0-9 Null Import-/Aufruf-Kanten

## Result
Implemented metadata allowlist + path retention, NodeNext import rewrite, full-repo resolution catalog, AST parse report, and bounded dependency fact preservation past prisma soft-cap.

## Measure (Enrichment OFF)
- browo-hr/browo-hr/backend: imports≈514, calls≈250, leaves.service incoming≥1, no `***` resolvedPath
- golden-set importEdges=19 (min 17)
- MAX_FILES remains 40

## Gates
checks PASS, deno unit tests PASS, golden-set OK
