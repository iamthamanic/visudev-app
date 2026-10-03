# Acceptance — RVP-11 Evolution Semantic History (#327)

## Intent

Evolution compares architecture across commits using versioned engine snapshots (#348) and semantic entity/relation diffs — not commit-count proxies.

## Preconditions

- #348 MERGED (`readHistoricalSnapshots`, `buildSnapshotKey`)
- SoftwareGraph snapshots + SemanticSystemModel builder exist

## Happy Path

1. Two HistoricalSnapshotRecords (distinct commits) → SemanticHistorySnapshots via #348 keys
2. Diff reports added/removed/changed semantic entities and relations
3. Evolution UI metrics/columns reflect snapshot/semantic diff, not git working-tree as architecture substitute
4. Identical semantic snapshots → zero differences

## Edge Cases

- No git history / <2 snapshots → honest nothing-found for semantic compare
- Identical commits → identical: true
- Incompatible cache versions already rejected by #348

## Acceptance

- [ ] Mindestens zwei verschiedene Commits können zu semantischen Snapshots analysiert werden
- [ ] Snapshot-Key basiert auf Repo + Commit SHA + Analyzer/Model-Version (#348)
- [ ] Diff erkennt neue/entfernte/geänderte semantische Entitäten und Relationen
- [ ] Keine Git-Historie → ehrlicher nothing-found-Zustand
- [ ] Identische Snapshots → korrekt keine Unterschiede
- [ ] UI-Trends basieren auf realen Snapshot-Daten, nicht Commit-Anzahl als Ersatz
- [ ] Zero type escape hatches

## Security Coverage

| Item      | Status                                            |
| --------- | ------------------------------------------------- |
| F-03      | Display helpers already sanitize; no new raw HTML |
| B-01/B-09 | Historical read remains project-scoped (#348)     |
| B-04/B-08 | Consumes redacted cache entries only              |
| P-04      | N/A — no new credentials                          |

## Verification

- `npx vitest run shared/semantic-history.test.ts src/modules/blueprint/components/evolution`
- `npm run checks`

## Implementation Notes

- `shared/semantic-history.ts` — history from ScanSnapshot / HistoricalRecord / SoftwareGraph; `diffSemanticHistory`; `attachHistoricalEngineSnapshots`
- Snapshot capture prefers semantic entity signatures (fallback: node signatures)
- Evolution metrics/columns use snapshot diff only; commit count not used as architecture sparkline
- Honest empty: `evolution-semantic-history-empty`, `evolution-git-nothing-found`
