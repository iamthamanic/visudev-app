# Feature: Local / GitHub semantic analysis parity (PR-16)

<!-- seeded for local-github-parity / issue 390 -->

## Intent

Same clean repo SHA under shared capabilities must yield equivalent SoftwareGraph / Semantic / UI-Data projections for Local and GitHub. Host-only capabilities are explicit deltas, never silent semantic mismatches. Cloud `document.graph` stays VisuDev IR (no lossy reverse).

## Preconditions

- Golden manifest marks ≥2 GitHub projects with `parity.enabled`
- Shared cutover path (`applyEngineHostCutover`) available

## Happy Path

- [ ] `compareLocalGithubParity` passes for each parity-enabled golden project when Local/Cloud receive the same SoftwareGraph
- [ ] Shared capability set defaults to `static-blueprint`
- [ ] Capability deltas list Local-only runtime/schema/filesystem as `hostSpecific: true`
- [ ] Cloud transport IR is not reverse-mapped in this slice

## Edge Cases

- [ ] Divergent graphs under shared capabilities → status `fail`
- [ ] Host-only capability gaps do not flip a semantic `pass` to `fail`

## Regression

- [ ] SDE-14 cloud-cutover tests still pass
- [ ] Readiness harness / RVP-12 gates unchanged

## Verify

```bash
cd Visudevfigma
npm run parity:local-github
npx vitest run shared/scan-detector/local-github-parity.test.ts shared/scan-detector/cloud-cutover.test.ts
```
