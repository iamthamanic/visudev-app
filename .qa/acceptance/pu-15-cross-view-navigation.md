# Feature: PU-15 · Add cross-view semantic navigation and evidence drill-down

<!-- seeded by ecc-runner from issue #436 on 2026-10-06 — @implement may refine -->

## Intent

Alle Verständnis-Views zu einem gemeinsamen Mental Model verbinden, damit ein ausgewähltes Konzept beim Wechsel zwischen Atlas, Architecture, Dependencies, Execution, Infrastructure, Diagnostics und Data erhalten bleibt und bis zur Evidence navigierbar ist.

## Happy Path

- [x] Blueprint view switch preserves stable ProductConcept selection across all seven Blueprint views.
- [x] Data/AppFlow deep links werden nur bei evidence-backed mappings angeboten; multiple targets werden explizit auswählbar.
- [x] Missing representation zeigt neutralen Zustand statt Selection still zu verlieren oder falsches Mapping zu wählen.
- [x] ProductConcept→Evidence→Code drill-down nutzt bestehende graph/code selection und redigierte evidence.
- [x] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Edge Cases

- [x] Concept not represented → keep `puConcept` + neutral banner
- [x] Diagnostics never claims product representation
- [x] Multiple software-graph evidence → require explicit `puEvidence` (no silent pick)
- [x] Data selects card by `conceptId` only when evidence-backed projection includes it

## Regression

- [x] Shell navigation preserves PU query params

## Assumptions

- Execution/Evolution map via shared focus helpers; local story/history ids resolved when present in projection
- AppFlow surface targets are listed by `listEvidenceNavigationTargets` (evidence-backed only); Data deep-link is wired in UI

## Screenshots

| Step | Filename            |
| ---- | ------------------- |
| 1    | `01-happy-path.png` |

## Implementation Notes

- Shared: `cross-view-selection.ts`, URL hook `src/hooks/useProductConceptSelectionUrl.ts`
- Blueprint provider + Atlas/Architecture/Dependencies/Infrastructure sync
- Neutral `ProductConceptMissingInView` for missing surfaces (incl. Diagnostics)
- Data page restores selection from `puConcept`

## Composition Gate

- Verdict: SKIPPED
- HEAD_SHA: 3c33b27a275184c6f1c15b8c5b7f3b81d35ba92a
- Reason: Selection transport + read-only focus; no side-effect fan-out
