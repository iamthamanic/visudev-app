# Acceptance: wave5-shell-footer-health

## Intent

Shell footer health line remains visible across Blueprint views while shared footer metrics preserve the canonical values of the loaded blueprint.

## Reference

Health/status affordance from the Blueprint target; metric semantics are governed by the canonical Blueprint metrics contract.

## Visual checklist

- [ ] Footer shows `Keine kritischen Probleme` (`footer-health-line`) when there are no high/critical findings.
- [ ] Canonical Module count is unchanged when switching Blueprint views.
- [ ] Health line persists across Blueprint views.
- [ ] No demo target-scale count is required to prove footer health.

## Playwright gate

```bash
PLAYWRIGHT_BASE_URL=http://localhost:3005 npx playwright test tests/e2e/wave5-shell-footer-health.spec.ts --project=chromium
```

## Criteria

- [ ] All visual checklist items pass.
- [ ] `npm run checks` green.
