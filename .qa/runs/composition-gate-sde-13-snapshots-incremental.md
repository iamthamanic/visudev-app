# Composition Gate — sde-13-snapshots-incremental

- HEAD_SHA: WORKTREE (uncommitted SDE-13; base ba9f2445)
- Date: 2026-10-03
- Verdict: CLEAR

## Event

Engine scan materializes a versioned ScanSnapshot; cache stores a redacted entry; Evolution (#327) reads ≥2 historical snapshots via `readHistoricalSnapshots`.

## Hop chain

`runWithCache` (producer) → `ScanCacheStore.put` (persist, redacted) → `planIncrementalScan` / key compatibility (transform) → `readHistoricalSnapshots` (consumer) → Evolution UI later (#327, out of scope) → no user-visible side-effect in this slice

## Simulations

| Case                | Intended                                                                                    | Composed                                                                                             | Result |
| ------------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------ |
| 1 event, N actors   | One scan → one cache entry per snapshot key                                                 | `put` keyed by `buildSnapshotKey`; list filters by projectId                                         | pass   |
| invalid / missing   | Corrupted entry or incompatible versions → miss, no silent reuse                            | `get` parse fail → null; `isSnapshotCompatible` false → previous discarded; historical skip on throw | pass   |
| 2 consumers / crash | Two historical readers see same project-scoped records; crash mid-put loses at most one key | Memory/FS put is whole-entry write; list skips bad JSON; no cross-project leak                       | pass   |

## Flags

| Tag      | Severity | Hops | Why local review missed it | Fix |
| -------- | -------- | ---- | -------------------------- | --- |
| _(none)_ |          |      |                            |     |

## Skip reason

n/a
