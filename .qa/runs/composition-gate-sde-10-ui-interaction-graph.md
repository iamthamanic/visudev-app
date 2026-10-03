# Composition Gate — sde-10-ui-interaction-graph (#345)

- HEAD_SHA: WORKTREE
- Date: 2026-10-02
- Verdict: CLEAR

## Event

Legacy Screen heuristics and optional runtime crawl compose into UIInteractionGraph facts.

## Path

Legacy Screen[] → adaptLegacyScreensToUiGraph → (optional) fuseRuntimeIntoUiGraph →
uiGraphToScanFacts → createWebUiDetector

Compat: UIInteractionGraph → projectUiGraphToLegacyScreens → Screen[]

## Simulations

| Sim              | Result                                               |
| ---------------- | ---------------------------------------------------- |
| N-actors         | Pure adapt/fuse/project                              |
| Invalid fallback | Empty screens → empty graph / detector success       |
| Concurrent       | Pure functions                                       |
| Conflict         | mismatch issues → conflicted surfaces (no overwrite) |

## Findings

None.
