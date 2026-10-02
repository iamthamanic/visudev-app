# Acceptance — SDE-05 Identity + Evidence Fusion (#340)

## Intent

Central conservative identity resolver fuses multi-detector facts/evidence without silent overwrite; conflicts stay first-class; LLM cannot override deterministic evidence.

## Acceptance

- [ ] Match statuses: confirmed / probable / unresolved / conflicted
- [ ] Static+runtime merge when consistent; contradictory claims → conflicted
- [ ] Deterministic, app-scope-safe ids; fusion audited via match records + evidence refs
- [ ] Secret-like values redacted before persist helpers
- [ ] Zero type escape hatches

## Verification

- `npx vitest run shared/scan-detector/identity-fusion.test.ts`
- `npm run checks`
