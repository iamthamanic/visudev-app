# Acceptance — SDE-04 Project Discovery (#339)

## Intent

Unify ProjectCapabilities discovery (applications/scopes, languages, frameworks, datastores, deployment hints) with evidence-based detection and shared ignore/containment policy.

## Acceptance

- [ ] `ProjectCapabilities` models apps/scopes, languages, frameworks, datastores, deployment hints
- [ ] `scopedSubjectId` prevents same route/symbol collisions across apps
- [ ] Unsupported languages appear in `unsupportedSourceInventory` (honest unknown)
- [ ] Skip-dir / max-size / extension policy lives in `shared/scan-detector/domain/discovery-policy.ts` and is used by Local adapter
- [ ] Zero type escape hatches

## Verification

- `npx vitest run shared/scan-detector/project-discovery.test.ts`
- `npm run checks`
