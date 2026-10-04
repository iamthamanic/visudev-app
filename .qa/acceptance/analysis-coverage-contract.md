# Feature: PR-04 · Surface capability-level completeness and honest empty states

## Intent

Pro Capability sichtbar machen, ob Analyse vollständig, teilweise oder nicht verfügbar war.

## Happy Path

- [x] Coverage je Capability verwendet ausschließlich COMPLETE/PARTIAL/UNAVAILABLE.
- [x] Leere Ergebnisse unterscheiden mindestens ABSENT/NOT_DETECTED/UNSUPPORTED/UNKNOWN.
- [x] Kein COMPLETE bei ausgelassenen unterstützten Inputs wegen Budget/Timeout.
- [x] Coverage-Ursache ist bis Parser/Runtime/Budget-Evidence nachvollziehbar.
- [x] Touched files: zero type escape hatches.

## Implementation Notes

- `shared/scan-detector/application/capability-coverage.ts`
- `emptyStateFromCoverage` for honest UI empty copy (DE)

## Composition Gate

- Verdict: SKIPPED
- Reason: shared coverage read-model; no new multi-hop business path
