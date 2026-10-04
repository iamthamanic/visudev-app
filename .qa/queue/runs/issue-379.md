#379 SemanticSystemModel v2 taxonomy

## Phase log
- implement: DONE (types, taxonomy helpers, inference, builder, atlas maps, tests)
- test-gate: PASS (`SKIP_AI_REVIEW=1 npm run checks` — 625 tests)
- verify-ticket: PASS (acceptance Happy Path + edge cases matched)
- composition-gate: CLEAR (`.qa/runs/composition-gate-semantic-taxonomy-v2.md`)
- verify-ui: N/A (kind labels / projection maps only; no UI create)
- review-ticket: ACCEPT (scoped to taxonomy; typed-strict clean)
- ecc-check: READY
- commit-pr / babysit / merge: pending
