# Feature: Product readiness hardening (PR-17)

<!-- seeded for product-readiness-hardening / issue 391 -->

## Intent

V1 surfaces hide unfinished work; browser console errors / React duplicate keys / page exceptions fail Product Readiness. AppFlow/Blueprint copy matches real capabilities.

## Happy Path

- [ ] `assertBrowserConsole` fails on `[error]`, `[pageerror]`, duplicate React keys
- [ ] Real visual audit writes `browser-console-assertions.json` and throws on failure
- [ ] Atlas glow-plate keys are unique (no label-only collisions)
- [ ] Infra: no fake “Physische Topologie folgt” / “Logs anzeigen” stubs
- [ ] Evolution: Commit Diff / Working Tree tabs absent until implemented
- [ ] Diagnostics: no “Ausnahmen verwalten” placeholder
- [ ] AppFlow preview hints distinguish Local vs Docker vs central

## Verify

```bash
cd Visudevfigma
npm test -- --run scripts/checks/browser-console-gate.test.ts \
  src/modules/blueprint/components/InfrastructureView.test.tsx \
  src/modules/blueprint/components/EvolutionView.test.tsx
```
