# Acceptance — PU-12 Infrastructure system topology

**Issue:** #433  
**Slug:** `pu-12-infrastructure-topology`

## Intent

Infrastructure als verständliche Systemtopologie darstellen: wo läuft was, wofür ist es da und wie kommuniziert es, bevor Vendor-/Deployment-Details gezeigt werden.

## Acceptance

- [x] Default Infrastructure zeigt purpose-first logical system parts aus ProductUnderstandingModel.
- [x] Connections verwenden verständliche meanings und behalten Evidence/KnowledgeStatus.
- [x] Vendor/runtime/region/physical descriptors sind Level-2/3 detail und werden nur bei Evidence gezeigt.
- [x] ABSENT, UNKNOWN, PARTIAL und UNSUPPORTED bleiben unterscheidbar.
- [x] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Composition Gate

- Verdict: SKIPPED
- Reason: read-only PU system-topology projection/UI; no producer–consumer side effects.
