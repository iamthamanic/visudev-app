# Acceptance: RVP-5 Atlas semantic projection

## Intent

Atlas is a semantic system landscape. It must not render the raw route/file graph as the default map.

## Contract

- Projection path is `SoftwareGraph -> SemanticSystemModel -> Atlas`.
- The shared `SemanticSystemModel` builder is the single canonical implementation for Local Engine and UI use.
- Default overview prefers applications and inferred business domains; when no domains exist it falls back to semantic services/components/data stores/external systems.
- Raw `route` and `file` nodes are never promoted to default Atlas nodes.
- Search acts as progressive disclosure for semantic services/components; raw graph membership stays available through domain groups for inspector drill-down.
- Initial semantic overview is capped at 40 visible objects; this is a display-density cap, not fabricated analysis data.
- Heights/colors continue to encode declared category semantics only; no fake LOC/fan-in/runtime values are introduced.

## Automated checks

- [ ] Projection test proves route/file labels are absent from the default view.
- [ ] Projection test proves business-domain membership retains underlying file/service node IDs for drill-down.
- [ ] Search can reveal a semantic service.
- [ ] Large semantic overview is capped at 40 objects.
- [ ] AtlasView tests use semantic application/domain fixtures rather than raw module groups.
- [ ] Existing Honest-Core coverage/truncation behavior remains intact.
- [ ] `npm run checks` / CI Quality, E2E and Golden Set are green.

## Real-project gate

With both demo enrichment flags OFF, `hrkoordinator` must no longer show `GET /...` routes or files as the primary Atlas districts. Headless WebGL color loss is not a semantic failure; labels, grouping and density are.
