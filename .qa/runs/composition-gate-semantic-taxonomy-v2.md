# Composition Gate — semantic-taxonomy-v2 (#379)

- HEAD_SHA: WORKTREE
- Date: 2026-10-04
- Verdict: CLEAR

## Event

SoftwareGraph node/edge evidence → SemanticSystemModel v2 entity/relation with kind + KnowledgeStatus → Atlas/Architecture projection consumers.

## Hops

1. Graph nodes (route/table/service/…) produce domain candidates in `inferBusinessDomainEntities`.
2. Taxonomy rules assign `business-domain` vs `resource` and KnowledgeStatus.
3. `buildSemanticSystemModel` promotes direct kinds + merges rollup relations.
4. Atlas `_projection` maps semantic kinds to graph display kinds (read-only).

## Simulations

| Case                                        | Expected                                            | Observed                 |
| ------------------------------------------- | --------------------------------------------------- | ------------------------ | --------------------------------------------------- | ---- |
| N=1 route-only segment                      | resource INTERPRETED; not business-domain           | PASS (tests)             |
| N≥2 source kinds / table                    | service                                             | repository               | business-domain with VERIFIED/SUPPORTED when strong | PASS |
| Logo/Seed/Pending/Template/Role             | never business-domain                               | PASS (denylist + golden) |
| Concurrent consumers (Atlas + Architecture) | same entity ids/kinds; no silent kind rewrite       | PASS (shared builder)    |
| Invalid fallback                            | weak heuristic ≤ INTERPRETED; unknown stays unknown | PASS                     |

## Cardinality / identity

- No side-effect fan-out (no mail/queue/webhook).
- One graph evidence set → one semantic entity id per kind+key; route-only uses `semantic:resource:*` not `semantic:business-domain:*`.

## Findings

None open.
