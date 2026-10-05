# Composition Gate — whole-repo-audit

- HEAD_SHA: `b63ff10e5024de8622ce739a6379cdab1670d970`
- Date: 2026-10-05
- Verdict: FLAGGED (product-level; not a single PR ship gate)
- Source: [Composition hop-chain audit](3d798bf6-0fe1-4ead-86a0-612c5425c5dd)

## Event

Three primary product events: Blueprint scan→graph→views; AppFlow scan→runtime→canvas; Data lineage assemble→Data UI.

## Hop chains

1. **Blueprint:** `scanProject` → `analysis.service` cache/snapshots → `enrichBlueprint` / `resolveBlueprintAnalysis` → `BlueprintPage` → `latestBlueprintRunId` → UI stats
2. **AppFlow:** `/appflow/analyze` → `appflow-cache` (+ `runtime-crawl.json`) → `resolveAppflowAnalysis` / `mergeRuntimeIntoAnalysis` → `LiveFlowCanvas` → badges / toolbar COMPLETE|PARTIAL
3. **Data lineage:** `getBlueprintLatest` + `getAppflowLatest` + ERD → `buildDataLineage` → `DataLineagePanel` → vollständig/teilweise/ungeklärt

## Simulations

| Case                | Intended                             | Composed                                                              | Result  |
| ------------------- | ------------------------------------ | --------------------------------------------------------------------- | ------- |
| N-actors            | Isolated project / single scan truth | Unguarded concurrent scans + unversioned latest caches                | flag    |
| invalid / missing   | Fail closed / UNKNOWN honest         | Lineage OK; Blueprint merge skip + AppFlow UNKNOWN→PARTIAL weak       | flag    |
| 2 consumers / crash | No stale identity across hops        | Gesamt-Scan merges **prior** runtime into Blueprint before this crawl | blocker |

## Flags

| Tag             | Severity | Hops                        | Why local review missed it                                                                              | Fix                                                                     |
| --------------- | -------- | --------------------------- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| identity/race   | blocker  | Blueprint Gesamt-Scan       | `ALL_SCAN_SEQUENCE` applies prior `runtime-crawl.json` in `analysis.service.ts` before this run’s crawl | Reorder: crawl → then merge; or refuse merge until crawl for same runId |
| label-lie       | flag     | AppFlow toolbar             | `UNKNOWN` rendered as `"PARTIAL"` in `CanvasToolbar.tsx`                                                | Map UNKNOWN → Ungeklärt / Keine Runtime                                 |
| silent-fallback | flag     | Blueprint / AppFlow resolve | `legacy-fallback` / merge skip only in metadata / console                                               | Surface fallbackUsed in UI                                              |
| race            | flag     | `store.tsx` startScan       | No mutex across blueprint/appflow auto-rescans                                                          | Global scan mutex / generation token for latest                         |
| identity        | flag     | Data lineage                | Blueprint `analyzedAt` vs independent ERD refresh skew                                                  | Bind lineage to shared run id                                           |
| silent-fallback | flag     | `build-data-lineage.ts`     | Software-graph table fallback can look SUPPORTED                                                        | Expose fallback provenance on hop                                       |
| identity        | flag     | cloud `requireProjectOwner` | null `ownerId` allowed in some Edge functions                                                           | Deny null owner everywhere (align with projects.controller)             |

## Skip reason

n/a
