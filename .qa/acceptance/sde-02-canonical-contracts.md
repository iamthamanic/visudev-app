# Acceptance — SDE-02 Canonical Contracts (#337)

## Intent

Introduce runtime-neutral Scan / Fact / Evidence / Capability contracts under `shared/scan-detector/` without replacing SoftwareGraph or SemanticSystemModel.

## Acceptance

- [ ] Status model includes `detected|inferred|observed|verified|conflicted|unknown` plus Provenance and Evidence refs
- [ ] `ScanSnapshot` carries engine/model/detector versions, repo/commit/dirty metadata, capability manifest
- [ ] Contracts import no Node/Deno/DOM/React/Supabase types
- [ ] Existing graph types remain backward compatible
- [ ] Zero type escape hatches

## Verification

- `npx vitest run shared/scan-detector/contracts.test.ts`
- `npm run checks`
