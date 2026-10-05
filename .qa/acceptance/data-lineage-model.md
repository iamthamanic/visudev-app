# Feature: Cross-layer DataLineage model (PR-21)

<!-- seeded for data-lineage-model / issue 395 -->

## Intent

DataGraph, SoftwareGraph, and UIInteractionGraph are joined into a runtime-neutral DataLineage read model using evidence-backed identity hops only. Partial paths stay explicitly partial; name-only joins never create relations.

## Preconditions

- SoftwareGraph, UIInteractionGraph, DataGraph contracts available
- Shared KnowledgeStatus / evidence ids on joins

## Happy Path

- [x] Lineage can represent evidenced Screen/Interaction → Endpoint → Service/Module → Data Entity paths
- [x] Every hop carries evidence + KnowledgeStatus
- [x] Missing hop truncates the path honestly (`partial` / `unresolved` + reason)
- [x] Model stays runtime-neutral (no UI / SQL profiler)

## Edge Cases

- [x] Same table label without shared evidence does not join DataGraph rows by name
- [x] UI transition without scan bind does not invent an endpoint hop
- [x] Dynamic / missing data hop leaves path partial

## Regression

- [x] Existing DataGraph / UI graph unit tests still pass
- [x] typed-strict: no new type escape hatches in touched files

## Verify

```bash
cd Visudevfigma
npx vitest run shared/scan-detector/build-data-lineage.test.ts
```
