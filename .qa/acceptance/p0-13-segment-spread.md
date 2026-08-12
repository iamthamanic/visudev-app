# P0-13 — Segmentstreuung messen

## Intent

Build `buildSegmentSpreadIndex` and calibrate `MAX_SPREAD_FOR_DOMAIN` / `MIN_SIBLING_DOMAINS` from measured parent-spread across visudev-test-repos. Do not wire into `detectDomain` yet (P0-10).

## Acceptance

- Index + `isDomainCandidate` exported; unused by heuristics in this issue.
- Evidence calibration table for every test repo (excl. evidence/, \_references/).
- Constants dated 2026-08-12 with evidence path comment.
- Unit tests for layer-high-spread, domain-spread-1, casefold, empty, label mode.
- `_heuristics.ts` unchanged.
