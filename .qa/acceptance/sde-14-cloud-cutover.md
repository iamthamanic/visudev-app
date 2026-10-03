# Acceptance — SDE-14 Cloud Analyzer Engine Cutover (#349)

## Intent

Deno/GitHub cloud analyzer becomes an infrastructure adapter over the shared ScanDetectorEngine contracts. Semantik/Evidence/Graph-Resolve are not a second Cloud implementation.

## Preconditions

- #343, #346, #347, #348 MERGED
- `resolveBlueprintAnalysis` + VisuDev→SoftwareGraph adapt available

## Happy Path

1. Cloud blueprint pipeline builds legacy VisuDev document (BC)
2. Adapter adapts VisuDev → SoftwareGraph via shared adapt
3. Calls shared `resolveBlueprintAnalysis` (mode from `VISUDEV_BLUEPRINT_ANALYSIS_MODE`, default shadow)
4. Capability present/absent listed explicitly on document metadata
5. Same fixture inputs → Local/Cloud semantic equivalence via shared resolve

## Edge Cases

- Missing cloud capabilities (runtime/DB) → listed absent, no invented evidence
- No VisuDev graph → cutover metadata notes gap; legacy document unchanged
- Secrets/tokens never enter shared facts

## Acceptance

- [ ] Deno-Analyzer ruft denselben shared Engine-Core/Contracts auf und enthält keine duplizierte semantische Resolver-Logik
- [ ] Local-vs-Cloud Golden Fixtures erzeugen bei gleichen Inputs semantisch äquivalente kanonische Modelle
- [ ] Capability-Unterschiede werden explizit im Snapshot manifestiert statt durch Fallback-Erfindungen kaschiert
- [ ] Bestehende Cloud API Contracts bleiben während Shadow/Cutover rückwärtskompatibel
- [ ] Touched files: zero type escape hatches

## Security Coverage

| Item      | Status                                                            |
| --------- | ----------------------------------------------------------------- |
| B-01/B-09 | Existing JWT/tenant guards unchanged; projectId scoped            |
| B-04/P-04 | access_token stays in GitHubService; not passed into shared facts |
| B-08      | Engine facts use existing redaction paths                         |

## Verification

- `npx vitest run shared/scan-detector/cloud-cutover.test.ts shared/visudev-to-software-graph.test.ts local-engine/src/services/visudev-to-software-graph.adapter.test.ts`
- `npm run checks`

## Implementation Notes

- `shared/visudev-to-software-graph.ts` — VisuDev adapt moved to shared; Local re-exports
- `applyEngineHostCutover` — shared Local/Cloud resolve + capability manifest
- Deno `attachCloudEngineCutover` after pipeline; additive `engineCutover` on BlueprintDocument
- Mode: `VISUDEV_BLUEPRINT_ANALYSIS_MODE` (default shadow); deno.json sloppy-imports + `@visudev/shared/`
- Tests: `shared/scan-detector/cloud-cutover.test.ts`; `deno check` cutover OK
