# Acceptance: wave4-footer-stats

## Intent

Blueprint footer and Atlas stats expose canonical metrics from the analyzed graph/scan instead of demo target-scale placeholders.

## Truth contract

- `Module` means exactly `SoftwareGraph` nodes with `kind=module`.
- `Dateien` uses the explicit analyzed-file metric (`filesAnalyzed`) when present.
- Legacy/demo metrics must not override canonical graph counts.
- `unknown` remains unknown; no Zielbild-scale fallback is allowed.
- Atlas and footer use the same metric definitions.

## Visual checklist

- [ ] Footer Module count equals the canonical `kind=module` count for the loaded blueprint.
- [ ] Footer Dateien count equals the explicit analyzed-file count for the loaded blueprint.
- [ ] Atlas stats use the same canonical definitions as the footer.
- [ ] Dependency count remains derived from the graph, not a static target number.
- [ ] No synthetic minimum such as `>= 100 Module` or mock target `1248` is required.

## Playwright gate

```bash
PLAYWRIGHT_BASE_URL=http://localhost:3005 npx playwright test tests/e2e/wave4-footer-stats.spec.ts --project=chromium
```

- Assert the rendered module count against the fixture graph's actual `kind=module` nodes.
- Assert the rendered file count against `filesAnalyzed`.

## Criteria

- [ ] All truth-contract and visual checklist items pass.
- [ ] `npm run checks` green.
