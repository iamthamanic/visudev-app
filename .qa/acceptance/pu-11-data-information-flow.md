# Acceptance — PU-11 Data business information flow

**Issue:** #432  
**Slug:** `pu-11-data-information-flow`

## Intent

Default Data beginnt bei ProductUnderstanding information concepts, nicht bei Tabellen.

## Acceptance

- [ ] Default Data view beginnt bei ProductUnderstanding information concepts, nicht bei Tabellen.
- [ ] Jeder Flow zeigt soweit evidence-backed origin, transformations/system hops, storage und consumers mit KnowledgeStatus.
- [ ] ERD/Columns/RLS bleiben erreichbar als technische Detailansicht, nicht als Level-1-Primärsprache.
- [ ] PARTIAL/UNKNOWN/CONFLICTED lineage wird sichtbar und Data/lineage error states bieten konsistenten Retry.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Composition Gate

- Verdict: SKIPPED
- Reason: read-only PU information-flow projection/UI; no producer–consumer side effects.
