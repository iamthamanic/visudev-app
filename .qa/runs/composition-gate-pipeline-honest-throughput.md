# Composition Gate — pipeline-honest-throughput

- HEAD_SHA: 099444a9703005fea4d57df1b18c683a41e1676a
- Date: 2026-09-16
- Verdict: CLEAR

## Event
Blueprint scan produces SoftwareGraph shown in Blueprint views (Architecture / Dependencies / Execution / Atlas / Data).

## Hop chain
preview-runner collectFileEntries → Deno blueprint-pipeline (VisuDevGraph+facts+truncation)
→ legacy-visudev-analysis.provider (passthrough visuDevGraph, stable route ids)
→ enrichBlueprint (buildSoftwareGraph + adapt/merge + semanticSystemModel)
→ analysis.service applyRuntimeCrawlToBlueprintGraph (optional observed edges)
→ persisted blueprint.latest → normalizeBlueprintData (totalFiles/truncation/semantic passthrough)
→ UI views

## Simulations
| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| 1 scan, N routes | one SoftwareGraph with adapted VisuDev edges | merge keeps fact hierarchy + VisuDev control edges | pass |
| invalid / missing VisuDevGraph | fact rebuild only | resolveSoftwareGraphFromScan returns factBuilt | pass |
| 2 consumers / crash | no queue/worker | single sync enrich path; runtime merge fail-closed (warn+skip) | pass |
| 1 crawl × N verified edges | only route-matched edges become observed | mergeRuntimeIntoSoftwareGraph skips unmatched | pass |
| truncation | UI shows partial when filesAnalyzed < filesDiscovered | totalFiles + truncation via normalize → TruncationBanner | pass |

## Flags
| Tag | Severity | Hops | Why local review missed it | Fix |
|-----|----------|------|----------------------------|-----|
| (none) | — | — | — | — |

## Skip reason
n/a
