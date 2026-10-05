# Feature: Evolution complete (PR-20)

<!-- seeded for evolution-complete / PR-20 -->

## Intent

Evolution shows real semantic architecture deltas between compatible snapshots and real Git commit diffs — never synthetic SHAs or silent incompatible compares.

## Happy Path

- [ ] Two compatible snapshots produce entity + relation diff metadata
- [ ] Incompatible engine majors surface `evolution-snapshot-incompatible` (no silent compare)
- [ ] Commit Diff tab uses real Git SHAs via rev-parse (`readCommitDiff`)
- [ ] Working Tree tab remains absent until implemented
- [ ] Touched files: zero type escape hatches

## Verify

```bash
cd Visudevfigma
npm test -- --run shared/semantic-history.test.ts \
  src/modules/blueprint/components/EvolutionView.test.tsx \
  local-engine/src/lib/git-commit-diff.test.ts
```
