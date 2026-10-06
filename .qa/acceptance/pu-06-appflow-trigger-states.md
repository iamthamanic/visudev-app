# Feature: PU-06 · Reconstruct UI triggers and transient interaction states

<!-- seeded by ecc-runner from issue #427 on 2026-10-06 — @implement may refine -->

## Intent

AppFlow von einer Screen-Sitemap zu einem echten Interaktionsmodell machen, indem konkrete UI-Trigger und transiente States zuverlässig rekonstruiert und verständlich visualisiert werden.

## Happy Path

- [ ] - [ ] AppFlow rendert transition trigger labels/controls statt nur abstrakter Screen-to-Screen-Kanten, wenn Evidence vorhanden ist.
- [ ] - [ ] Modal/Drawer/Tab/Menu/Popover werden als parent-bound Ghost Layers projiziert und nicht als unabhängige Route-Screens.
- [ ] - [ ] Trigger, transition und transient surface behalten KnowledgeStatus + Evidence; fehlende Trigger bleiben explizit unknown.
- [ ] - [ ] Existing navigate/open/close/switch/menu semantics bleiben verlustfrei durch UIInteractionGraph-Projektion.
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

- `normalizeUiTrigger` redacts secret-like trigger fields; empty → display "unknown".
- `projectUiGraphToAppflow` sets edge `triggerDisplay` / `triggerUnknown` and downgrades open/switch/menu without trigger to status unknown.
- `FlowEdgesLayer` renders visible SVG trigger labels; `FlowNodeCard` marks modal/tab/menu as Ghost Layers with parent aria.
- `computePositions` offsets ghost nodes from parent.
