# Composition Gate — sde-14-cloud-cutover

- HEAD_SHA: WORKTREE
- Date: 2026-10-03
- Verdict: CLEAR

## Event

Cloud blueprint analysis attaches shared engine cutover telemetry after VisuDev assemble; Local/Cloud resolve via applyEngineHostCutover.

## Hop chain

GitHub fetch (secrets stay here) → analyzeFromFileEntries → attachCloudEngineCutover → adaptVisuDev→SoftwareGraph (shared) → resolveBlueprintAnalysis (shared) → engineCutover metadata on BlueprintDocument

## Simulations

| Case              | Intended                                                  | Composed                         | Result |
| ----------------- | --------------------------------------------------------- | -------------------------------- | ------ |
| 1 event, N actors | One analysis → one document + one cutover                 | Single attach at end of pipeline | pass   |
| invalid / missing | No VisuDev graph → note + empty graph cutover, VisuDev BC | note: no-usable-visudev-graph    | pass   |
| 2 consumers       | Same SoftwareGraph Local/Cloud → same semantic ids        | cloud-cutover.test golden        | pass   |

## Flags

_(none)_

## Skip reason

n/a
