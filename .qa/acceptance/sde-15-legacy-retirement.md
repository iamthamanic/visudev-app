# Acceptance — SDE-15 Legacy Analyzer Retirement (#350)

## Intent

Collapse runtime analysis to a single engine authority after #328 green. Retire legacy/shadow modes; keep offline golden-set parity; product slices use `src/lib/visudev-api` facades.

## Acceptance

- [x] #328 merged with enrichment-OFF Real Project Gate before retirement
- [x] Analysis modes default to `engine`; legacy/shadow env values map to engine
- [x] Resolve paths (Blueprint/AppFlow/Data) no longer dual-render legacy/shadow
- [x] Cloud attaches shared `engineCutover` (mode/source/capabilities/semantics); VisuDev `document.graph` IR stays for API shape (no lossy SoftwareGraph→VisuDev reverse)
- [x] Local enrich: render/semantic from engine projection; security diagnostics from scan materialization (`diagnosticGraph`)
- [x] Product slices do not import `shared/scan-detector` or `local-engine/**`
- [x] `npm run checks` green; zero type escape hatches in touched files

## Composition Gate

- HEAD_SHA: 14fa2c48ff3da4c6e0c7ed2c0b5f8e0815c33576
- Verdict: CLEAR
- Event: Analysis resolve for Blueprint/AppFlow/Data always produces engine-projection (or explicit legacy-fallback). Cloud API keeps VisuDev graph IR; engine authority is cutover + Local document.graph projection.
