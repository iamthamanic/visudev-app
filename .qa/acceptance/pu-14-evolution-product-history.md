# Feature: PU-14 · Turn Evolution into semantic product history

<!-- seeded by ecc-runner from issue #435 on 2026-10-06 — @implement may refine -->

## Intent

Evolution von Git-/Snapshot-Metriken zu verständlicher semantischer Produktgeschichte machen.

## Happy Path

- [x] Evolution kann ProductUnderstanding snapshots vergleichen und concept/responsibility/relation changes gruppieren.
- [x] Default Timeline verwendet verständliche semantische Change-Copy; SHA/files sind sekundäre Evidence.
- [x] Incompatible/insufficient history wird ehrlich erklärt und nicht als semantischer Vergleich ausgegeben.
- [x] Default-Dichte wird reduziert und große Change-Sets werden gruppiert/drill-down-fähig.
- [x] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Edge Cases

- [x] Snapshots incompatible → honest empty/incompatible UI (no fake semantic compare)
- [x] Only git commits / insufficient signatures → non-comparable with German reason
- [x] Large change set → condensed preview + group drill-down
- [x] Technik layer retains commit/file evidence via explicit drill-down

## Regression

- [x] Evolution E2E (wave2/3/5) opens Technik layer for prior git/metrics assertions
- [x] Unit coverage for product-history projection + Evolution default layer

## Assumptions

- none

## Screenshots

| Step | Filename            |
| ---- | ------------------- |
| 1    | `01-happy-path.png` |

## Implementation Notes

- Projection: `shared/product-understanding/project-evolution-product-history.ts`
- Default UI: `EvolutionProductHistoryView` behind Produktgeschichte layer in `EvolutionView`
- Technik remains commit timeline / metrics / file evidence

## Composition Gate

- Verdict: SKIPPED
- HEAD_SHA: 49cc75ff96da6104c3a78468a2f7cc0fbee4a6b0 (pre-commit; updated at ship)
- Reason: Single-hop read-only projection/UI. No side-effect fan-out.
