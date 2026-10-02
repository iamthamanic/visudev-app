# Acceptance — RVP-10 Diagnostics Root-Cause Clustering (#326)

## Intent

Diagnostics overview prioritizes root-cause clusters (rule/scope/semantic unit) instead of a flat finding flood. Drill-down keeps original findings + evidence.

## Acceptance

- [x] Similar findings cluster into explainable groups
- [x] Clusters show impacted routes/components/domains counts
- [x] Confidence and `unknown` are not reinterpreted as certainty
- [x] Drill-down lists all original findings + evidence
- [x] Original severity is not artificially raised
- [x] Security matrix remains functional
- [x] Zero type escape hatches

## Verification

- `npx vitest run src/modules/blueprint/components/diagnostics/diagnostics-root-cause-clusters.test.ts`
- `npm run checks` — PASS (564 tests)

## Composition Gate

SKIPPED — single-hop UI clustering; proof `.qa/runs/composition-gate-rvp10-diagnostics-clustering.md`

## Security Coverage

- F-03 / B-01 / B-04 / B-07 / B-08 / B-09 / P-04: N/A — no new auth, secrets, uploads, or network trust boundaries; pure client-side grouping of existing findings.

## Implementation Notes

- `diagnostics-root-cause-clusters.ts` groups by `ruleId + category + expectedState + actualState`
- Severity = max of members; `unknownCount` + average confidence shown separately
- `DiagnosticsRootCauseClusters` overview above findings table; selecting a cluster scopes the table
- Security matrix / Problem-Inspektor unchanged
