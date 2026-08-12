# P0-6 — Security findings require analyzability (acceptance)

## Intent

`missing` auth/validation only when the route file is analyzable and no typed evidence exists. HTTP method must not invent missing. Report unknown when not analyzable.

## Happy Path

- [x] `resolveAuthState` / `resolveValidationState` ignore MUTATING_METHODS
- [x] Typed `auth-check` / `validation-deny-400` → confirmed
- [x] Regex-only snippet → partial (not confirmed)
- [x] Analyzable without evidence → missing; not analyzable → unknown
- [x] German finding copy without „Sicherheitslücke“
- [x] Golden-set `missingAuthFindings` max 1 (mutating primary scopes)

## Verification

```bash
npm run test:run -- shared/blueprint-graph-inference
npm run golden-set
npm run typecheck
```
