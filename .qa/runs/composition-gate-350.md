# Composition Gate — sde-15-legacy-retirement

- HEAD_SHA: WORKTREE (findings fix)
- Date: 2026-10-04
- Verdict: CLEAR

## Event

Blueprint / AppFlow / Data analysis resolve: consumer always receives engine-projection (or explicit legacy-fallback). Mode no longer changes render destination (shadow dual-path removed).

## Hop chain

Scan materialization → `resolve*` (engine) → Local `BlueprintDocument.graph` / AppFlow screens / Data ERD → UI  
Cloud: VisuDev assemble → `applyEngineHostCutover` → `engineCutover` metadata (graph IR unchanged)

## Simulations

| Case                | Intended                                       | Composed                               | Result |
| ------------------- | ---------------------------------------------- | -------------------------------------- | ------ |
| N actors            | Same engine authority Local/Cloud/AppFlow/Data | Shared resolve + host cutover          | pass   |
| Invalid / truncated | Explicit fallback                              | `legacy-fallback` + reason             | pass   |
| Cloud graph         | Keep VisuDev IR; engine via cutover            | No lossy reverse onto `document.graph` | pass   |

## Flags

None.

## Skip reason

n/a

## Notes

Security diagnostics (`deriveDiagnosticsFromGraph`, access-control) use scan materialization (`diagnosticGraph` / `legacyGraph`), not the projected render graph, so auth/validation evidence is not dropped by SDE-15 engine cutover.
