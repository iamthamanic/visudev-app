# Acceptance — SDE-12 DataGraph + Data cutover (#347)

## Intent

Canonicalize DB/schema knowledge as DataGraph via the engine. Keep DataPage on an ERD compatibility projection; no separate UI-side schema analyzer in engine mode.

## Acceptance

- [x] DataGraph models database/schema/table/column/relation/policy with Evidence when evidenced
- [x] DataPage continues via ERD compatibility projection
- [x] Engine mode does not run a separate UI-side schema analyzer
- [x] Multiple datastores and migration-vs-live stay provenance-visible
- [x] Zero type escape hatches

## Verification

- `npx vitest run shared/scan-detector/data-graph.test.ts`
- `npm run checks` — PASS

## Composition Gate

CLEAR — `.qa/runs/composition-gate-sde-12-data-graph-cutover.md`

## Security Coverage

- Sample rows never enter DataGraph
- Policy expressions / secret-like defaults redacted
- F-03/B-01/B-04/B-07/B-08/B-09/P-04: no new credential surfaces; adapter only rewrites ERD shape

## Implementation Notes

- `shared/data-graph.types.ts` + adapt/project/facts/detector/resolve
- Mode: `VISUDEV_DATA_ANALYSIS_MODE` / `VITE_VISUDEV_DATA_ANALYSIS_MODE` (default shadow)
- `data.api-adapter` getERD runs resolveDataAnalysis (no UI schema analyzer)
