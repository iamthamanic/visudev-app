# Acceptance — SDE-09 Runtime Observer Contract (#344)

## Intent

Playwright runtime crawl becomes an Engine RuntimeEvidenceProvider: observations are equal evidence, can verify/conflict static claims, and may introduce runtime-only candidates under a safe-action policy.

## Acceptance

- [x] Playwright crawl yields standardized Runtime Facts/Evidence via engine port
- [x] Runtime-only observations can exist without forcing a static match
- [x] Static-vs-runtime mismatch becomes `conflicted`/Issue (not silent overwrite)
- [x] Dangerous-action policy covered by tests
- [x] Zero type escape hatches on touched files

## Verification

- `npx vitest run shared/scan-detector/runtime-observer.test.ts`
- `npm run checks`

## Composition Gate

CLEAR — `.qa/runs/composition-gate-sde-09-runtime-observer.md`

## Security Coverage

- Dangerous actions blocked by policy (delete/pay/logout/send/deploy…)
- Screenshots/tokens: normalize stores `hasScreenshot` boolean only; redactEvidence applied
- F-03/B-01/B-04/B-07/B-08/B-09/P-04: no new auth endpoints; local crawl only

## Implementation Notes

- Port: `RuntimeEvidenceProvider` + `createRuntimeObserverDetector`
- Policy: `safe-action-policy.ts` (+ `.mjs` for preview-runner)
- `preview-runner/runtime-crawl.js` uses shared policy
- Adapter: `preview-runner/runtime-observer-adapter.js`
