# Acceptance — SDE-15 Legacy Analyzer Retirement (#350)

## Intent

Collapse runtime analysis to a single engine authority after #328 green. Retire legacy/shadow modes; keep offline golden-set parity; product slices use `src/lib/visudev-api` facades.

## Acceptance

- [x] #328 merged with enrichment-OFF Real Project Gate before retirement
- [x] Analysis modes default to `engine`; legacy/shadow env values map to engine
- [x] Resolve paths (Blueprint/AppFlow/Data) no longer dual-render legacy/shadow
- [x] Cloud cutover promotes engine-projection graph onto `document.graph`
- [x] Product slices do not import `shared/scan-detector` or `local-engine/**`
- [x] `npm run checks` green; zero type escape hatches in touched files

## Composition Gate

- HEAD_SHA: WORKTREE
- Verdict: CLEAR
- Event: Analysis resolve for Blueprint/AppFlow/Data now always produces engine-projection (or explicit legacy-fallback) — no shadow fan-out that changes render destination by mode.
