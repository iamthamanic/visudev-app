# Issue #263 — P0-8 Fact export prioritization

## Phase
implement → verify → review → ecc-check → PR

## Changes
- Priority-based fact selection with per-file coverage (`FACT_EXPORT_PRIORITY`)
- `FactSelectionReport` on BlueprintDocument + RawBlueprintScan
- Removed positional `rest.slice(0, n)` from export cap
- 6 new Deno unit tests for selection behavior

## Gates (pending)
- [ ] test-gate / npm run checks
- [ ] verify-ticket
- [ ] review-ticket
- [ ] review-security
- [ ] ecc-check READY
- [ ] PR + CI + merge
