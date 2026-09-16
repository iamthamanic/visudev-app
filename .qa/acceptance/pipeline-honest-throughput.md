# Acceptance — pipeline-honest-throughput

## Intent
Harden VisuDEV’s AST/regex → SoftwareGraph path (no Graphify): pass Deno VisuDevGraph through, raise caps with truncation honesty, merge AppFlow runtime observations, tag extracted/inferred edges, then ship targeted visuals on real IR.

## Preconditions
- Local Engine + Preview Runner available for Blueprint scan
- Demo enrichment off in CI (`VISUDEV_DEMO_ENRICHMENT` unset/false)

## Happy Path
- [x] Provider preserves Deno route IDs and `visuDevGraph`
- [x] Enrichment adapts/merges VisuDevGraph into SoftwareGraph (fact rebuild fallback)
- [x] Route `pipeline` projected when present (not hard-empty)
- [x] FILE_LIMIT default 800; MAX_BLUEPRINT_FACTS default 1000 (env-overridable)
- [x] Truncation report / totalFiles drives German partial-scan banner
- [x] Runtime crawl merges observed edges with `provenance: observed`
- [x] Edge inspector shows „aus Code“ / „abgeleitet“
- [x] ERD FK edges from introspection + Prisma relations
- [x] Open-in-Editor/GitHub links (path-safe)
- [x] Dependencies overlays Security/API/Events
- [x] Architecture level nav System→Domain→Modul→Datei (semantic + graph)
- [x] Atlas treemap / Execution sequence when IR dense enough; honest empty otherwise

## Edge Cases
- [x] No VisuDevGraph → fact-only rebuild
- [x] No runtime crawl → graph unchanged
- [x] Thin graph → treemap/sequence empty copy (no fakes)
- [x] Unsafe relative paths → no editor deep link

## Composition Gate
See `.qa/runs/composition-gate-pipeline-honest-throughput.md`
