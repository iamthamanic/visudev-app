# Acceptance — SDE-01 Migration Baseline (#336)

## Intent

Freeze a reproducible semantic baseline (AppFlow / Blueprint / Data / SoftwareGraph / SemanticSystemModel) and a shadow-parity comparator before engine cutover. Additive only — no consumer path changes.

## Acceptance Criteria

### AC-1 — Semantic baseline fingerprint

- `extractSemanticBaseline` captures node/edge kind counts, route ids, table ids, semantic entity/relation kinds, business-domain labels, AppFlow screen/flow ids, and Data table ids/labels.

### AC-2 — Shadow parity comparator

- `compareShadowParity(expected, actual)` reports missing / unexpected / conflicts without switching UI consumers.
- Identical fingerprints → `pass`; dropped legacy route → `fail` with missing finding.

### AC-3 — Golden fixture freeze (Enrichment OFF)

- `tests/fixtures/golden-repo/expected-semantic-baseline.json` stores the frozen fingerprint.
- `npm run golden-set` asserts live analyzer output against that baseline (`enrichment: "off"`) and documents allowed unknowns (`partial-scan`, `inferred-route`).

### AC-4 — No production path changes

- Existing scan endpoints and UI consumers remain untouched.

### AC-5 — typed-strict

- No type escape hatches in touched files.

## Verification

- `npx vitest run shared/migration-baseline.test.ts`
- `npm run golden-set`
- `npm run checks`
