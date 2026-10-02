# Acceptance — SDE-08 Blueprint Shadow/Engine Cutover (#343)

## Intent

Blueprint consumes SoftwareGraph/SemanticSystemModel via the ScanDetectorEngine Projection/Query layer. Engine runs in shadow against legacy first; after baseline parity Engine becomes authoritative with legacy fallback until SDE-15.

## Goal

Blueprint views and open RVP projections share engine truth without a parallel source scan.

## Non-Goals

- No redesign of the seven Blueprint views
- No deletion of legacy analyzers
- No AppFlow/Data cutover

## Preconditions

- #342 (SDE-07 projection/query) merged
- Static detector + shadow compare available

## Happy Path

1. Given a RawBlueprintScan,
2. When `VISUDEV_BLUEPRINT_ANALYSIS_MODE` is `legacy` | `shadow` | `engine`,
3. Then enrichment resolves the render graph per mode; shadow compares engine via projection; engine uses projection-only materialization with explicit legacy fallback on failure.

## Edge Cases

- Legacy vs engine ID/order differences with same semantics → parity OK
- Partial engine / truncated projection → documented telemetry, no silent mix
- Engine failure → explicit fallback flag, no mixed model without notice

## Acceptance

- [ ] Blueprint can run `legacy`, `shadow`, and `engine`; `shadow` renders legacy and compares engine
- [ ] Engine mode uses Projection/Query only (no separate Blueprint source scan)
- [ ] Parity telemetry/tests green for round-trip semantics
- [ ] RVP contracts remain SoftwareGraph-compatible
- [ ] Zero type escape hatches

## Security Coverage

- Mode switch is env-gated; does not mix cloud/local sources in one document
- Evidence stays project-scoped via existing ScanSnapshot projectId checks

## Verification

- `npx vitest run shared/scan-detector/blueprint-analysis-mode.test.ts local-engine/src/services/blueprint-enrichment.service.test.ts`
- `npm run checks`

## Composition Gate

- Verdict: **CLEAR** — see `.qa/runs/composition-gate-sde-08-blueprint-cutover.md`

## Implementation Notes

- `resolveBlueprintAnalysis` + `softwareGraphFromBlueprintProjection` in shared/scan-detector
- `enrichBlueprint` honors `VISUDEV_BLUEPRINT_ANALYSIS_MODE` (default shadow)
- Telemetry on `providerMetadata.blueprint*`
