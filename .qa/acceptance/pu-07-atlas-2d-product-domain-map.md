# Feature: PU-07 · Rebuild Atlas as a 2D product-domain map

<!-- seeded by ecc-runner from issue #428 on 2026-10-06 — @implement may refine -->

## Intent

Atlas von abstrakter Code-/3D-Metapher zu einer verständlichen 2D-Produktlandkarte umbauen.

## Happy Path

- [ ] - [ ] Primäre Atlas-Ebene rendert ausschließlich ProductUnderstanding application/product-area/capability semantics, nicht raw file/route/module labels.
- [ ] - [ ] Jeder primäre Node zeigt verständlichen Namen + 1-Satz-Purpose; KnowledgeStatus ist sekundär sichtbar.
- [ ] - [ ] Technische Artefakte erscheinen nur per Drill-down/Inspector mit Evidence.
- [ ] - [ ] 3D ist kein primärer/required Atlas-Pfad mehr; Product-Understanding-Atlas ist vollständig in 2D bedienbar.
- [ ] - [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Edge Cases

- [ ] (from .qa/edge-cases.md + @implement)

## Regression

- [ ] Feed and topic routes still load

## Assumptions

- none

## Screenshots

| Step | Filename            |
| ---- | ------------------- |
| 1    | `01-happy-path.png` |

## Implementation Notes

- `projectAtlasProductMap` + `projectAtlasFromProductUnderstanding` drive Atlas primary nodes from ProductUnderstanding only (application / product-area / capability).
- Cards show name + purpose; KnowledgeStatus secondary; technicalRefs only in inspector.
- `useAtlasViewModeState` forces 2D; 3D toggle removed from AtlasControls.
