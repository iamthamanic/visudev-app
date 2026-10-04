# Composition Gate — atlas-semantic-v2 (issue 380)

- HEAD_SHA: 7147dab92ee3b1a8312b845e0a8aacdc9eeead8c
- Date: 2026-10-04
- Verdict: CLEAR

## Event

SemanticSystemModel entities (kind + KnowledgeStatus + evidence) → Atlas projection districts/nodes → Inspector evidence UI.

## Hops

1. Shared builder emits v2 entities with knowledgeStatus.
2. Atlas projection selects primary kinds (app/domain/capability) or technical fallback.
3. Selection resolves semantic entity for inspector.
4. Inspector renders status/confidence/evidence; legend encodes tones.

## Simulations

| Case                     | Expected                                                       | Observed     |
| ------------------------ | -------------------------------------------------------------- | ------------ |
| Business domain present  | District from domain, not route/file                           | PASS (tests) |
| Resource-only logo route | Not rendered as business-domain district                       | PASS         |
| No domains               | Technical clusters; inspector still shows status when selected | PASS         |
| INTERPRETED vs VERIFIED  | Weak vs strong tone attributes                                 | PASS         |

## Cardinality / identity

- No side-effect fan-out.
- One semantic entity id → one atlas node / optional district.

## Findings

None open.
