# Feature: Data lineage navigation UI (PR-22)

<!-- seeded for data-lineage-ui / issue 396 -->

## Intent

Data View exposes Forward Lineage and Reverse Impact from the canonical DataLineage model. Visible hops show KnowledgeStatus + evidence from the model only; partial/unresolved paths stay explicit; fan-outs stay filterable.

## Preconditions

- DataLineage model on main (`buildDataLineage`)
- Blueprint SoftwareGraph and Data ERD available for a project

## Happy Path

- [x] Data View supports Forward Lineage and Reverse Impact navigation
- [x] Every visible hop shows Status/Evidence from the canonical model (no UI inference)
- [x] PARTIAL/UNKNOWN (ungeklärt) lineage is shown explicitly
- [x] Large fan-outs remain filter- and drill-down-fähig

## Edge Cases

- [x] Missing SoftwareGraph → honest empty state (no invented hops)
- [x] Partial truncationReason rendered from model
- [x] Search + limit for fan-out

## Regression

- [x] Existing DataPage columns/RLS/sample tabs unchanged
- [x] typed-strict: no type escape hatches in touched files

## Verify

```bash
cd Visudevfigma
npx vitest run src/modules/data/lib/data-lineage-navigation.test.ts shared/scan-detector/build-data-lineage.test.ts
npm run checks
```
