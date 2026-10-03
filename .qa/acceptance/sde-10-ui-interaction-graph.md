# Acceptance — SDE-10 UIInteractionGraph (#345)

## Intent

Model UI as a canonical UIInteractionGraph (surfaces/states/transitions) independent of URL/framework. Web heuristics adapt into evidence; legacy Screen[] projects from the graph; runtime can verify, conflict, or add runtime-only states.

## Acceptance

- [x] UIInteractionGraph models surfaces/states and transitions independently of URL/framework
- [x] Existing Web AppFlow heuristics reused as adapter delivering Evidence (not authoritative Screen[])
- [x] Legacy Screen[] projectable from UIInteractionGraph for AppFlow compat
- [x] Runtime can verify, conflict, or add runtime-only states
- [x] Zero type escape hatches on touched files

## Verification

- `npx vitest run shared/scan-detector/ui-interaction-graph.test.ts`
- `npm run checks` — PASS

## Composition Gate

CLEAR — `.qa/runs/composition-gate-sde-10-ui-interaction-graph.md`

## Security Coverage

- Runtime fusion follows SDE-09 safe-action (no new click automation here)
- DOM evidence summaries only; screenshot presence boolean, no form secrets
- F-03/B-01/B-04/B-07/B-08/B-09/P-04: N/A — no new auth/network trust boundaries

## Implementation Notes

- `shared/ui-interaction-graph.types.ts` — canonical IR
- Adapters: legacy Screen[] → graph → Screen[] projection; runtime fuse; ScanFact bridge
- Detector: `createWebUiDetector`
