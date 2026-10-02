# Acceptance — RVP-9 Infrastructure Semantic Topology (#325)

## Intent

Infrastructure shows only real Deployment / Runtime / Data / External entities — not files, routes, or code nodes as RUNNING services.

## Acceptance

- [ ] Files and Routes do not appear as RUNNING infrastructure services
- [ ] Deployment units derive from Compose/K8s/real runtime facts
- [ ] Datastores and External Systems only with evidence
- [ ] RUNNING only with real runtime evidence; otherwise neutral/unknown
- [ ] Service ↔ deployment-unit mapping is evidence-based when present
- [ ] Repo without deployment descriptors stays honest nothing-found/unknown
- [ ] Zero type escape hatches

## Verification

- `npx vitest run src/modules/blueprint/components/infrastructure/`
- `npm run checks`

## Composition Gate

- Verdict: **CLEAR**

## Implementation Notes

- `infrastructure-entities.ts` whitelist + runtime status
- Projection excludes files/routes/softort runtimes
- RUNNING only with runtime evidence
