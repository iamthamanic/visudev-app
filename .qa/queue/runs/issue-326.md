# Issue #326 — RVP-10 Diagnostics Root-Cause Clustering

## Phase log

- setup: claimed `feat/326-rvp10-diagnostics-clustering` from main @ 83189758
- implement: cluster helper + UI overview + drill-down + tests
- verify-ticket: PASS (`npm run checks`)
- composition-gate: SKIPPED (single-hop UI)
- review-ticket: ACCEPT (scoped Diagnostics UI; no severity inflation)
- ecc-check: READY
- PR / babysit / merge: pending

## Diff scope

- `src/modules/blueprint/components/diagnostics/diagnostics-root-cause-clusters.ts`
- `src/modules/blueprint/components/diagnostics/DiagnosticsRootCauseClusters.tsx`
- `src/modules/blueprint/components/diagnostics/DiagnosticsFindingsTable.tsx`
- `src/modules/blueprint/styles/DiagnosticsView.module.css`
- tests + acceptance + composition proof
