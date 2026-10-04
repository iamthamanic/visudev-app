# Feature: PR-03 · Preserve full-fidelity authoritative ScanSnapshots before projection caps

## Intent

Die authoritative truth layer vor Export-/UI-Budgets vollständig erhalten, statt Facts vor SoftwareGraph/Semantik abzuschneiden.

## Happy Path

- [x] Engine/semantic projections konsumieren vollständige redigierte Facts/Evidence vor Export-Cap.
- [x] Export-Caps begrenzen nie den authoritative ScanSnapshot.
- [x] Golden gate beweist für hrkoordinator `authoritativeFacts === extractedFacts` bei vollständigem Capability-Scan.
- [x] Große Snapshots bleiben cachebar; UI-Transport bleibt begrenzt.
- [x] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Implementation Notes

- Pipeline builds authoritative graph (`applyExportCap: false`) before engine cutover
- `document.facts` / final `document.graph` remain transport-capped
- `authoritativeTruth` report + semantics gate invariant

## Composition Gate

- Verdict: SKIPPED
- Reason: pipeline truth-boundary fix; no new multi-hop business event path
