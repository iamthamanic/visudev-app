# Handoff — ecc-runner-loop

## Session shipped (merged)
- #425 PU-04 → PR #441 (`0fe9e2c8`)
- #426 PU-05 → PR #442 (`1f2cd047`)
- #427 PU-06 → PR #443 (`3945c0e0`)

## Active (not finished)
- **#428** PU-07 · Rebuild Atlas as a 2D product-domain map
- Branch: `feat/428-pu-07-atlas-2d-product-domain-map` (local, uncommitted beyond acceptance seed)
- Labels: `agent-in-progress`
- Acceptance: `.qa/acceptance/pu-07-atlas-2d-product-domain-map.md`
- Phase: implement (just claimed)

## Implement brief for #428
1. Primary Atlas layer = ProductUnderstanding `application` / `product-area` / `capability` (purpose-first), not raw file/route/module.
2. Tech artifacts only in drill-down/inspector with evidence.
3. Default + required path = 2D; retire 3D as primary (today `useAtlasViewModeState` defaults to `"3d"` — flip to `"2d"`, demote/hide city toggle for PU path).
4. Reuse ProductUnderstandingModel + explanation presenter; no new graph library; no 3D city metaphor.
5. Key files: `AtlasView.tsx`, `useAtlasViewModeState.ts`, `AtlasViewModeToggle.tsx`, `atlas-treemap-projection.ts` / display, `shared/product-understanding/*`.

## Queue
- Next after #428: #429…#437 (deps unlock sequentially)
- Epic #421 stays tracking until #437

## paused
false — resume with `@ecc-runner-loop continue`
