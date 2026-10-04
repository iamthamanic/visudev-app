# Feature: PR-05 · Introduce SemanticSystemModel v2 taxonomy and deterministic classification

<!-- seeded by ecc-runner from issue #379 on 2026-10-04 — @implement may refine -->

## Intent

Eine kanonische Semantik-Taxonomie einführen, damit technische Ressourcen nicht als fachliche Domains erscheinen.

## Happy Path

- [x] v2 unterscheidet mindestens application/business-domain/capability/resource/service/technical-module/endpoint/data-store/external-system/security-control/deployment-unit/runtime/execution-flow.
- [x] Business-domain/Capability entsteht nicht allein aus einem einzelnen Pfadsegment.
- [x] Starke deterministische Evidence erzeugt VERIFIED/SUPPORTED; schwache Heuristik höchstens INTERPRETED.
- [x] Golden Assertions verhindern bekannte Resource→Business-Domain-Fehlklassifikationen.
- [x] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Edge Cases

- [x] Layer-first repo — route-only segments become `resource` INTERPRETED, not business-domain.
- [x] RESOURCE_NOT_BUSINESS_DOMAIN denylist (Logo/Seed/Pending/Template/Role/…).
- [x] Security-control label override on service nodes.

## Regression

- [x] Semantic builder/tests + atlas kind maps compile; `npm run checks` PASS.

## Assumptions

- Atlas/Architecture UI migration is out of scope; only kind-label / projection map updates for v2 kinds.

## Screenshots

| Step | Filename                           |
| ---- | ---------------------------------- |
| 1    | N/A (no UI create; label map only) |

## Implementation Notes

- `shared/semantic-system-model.types.ts` — v2 kinds + required `knowledgeStatus` on entities/relations; version `2`.
- `shared/semantic-taxonomy-v2.ts` — denylist, `qualifiesAsBusinessDomain`, `knowledgeStatusFromSignals`.
- `shared/semantic-domain-inference.ts` — multi-signal business-domain; route-only → resource INTERPRETED.
- `shared/semantic-system-model.ts` — direct promotions (endpoint/runtime/technical-module/security-control).
- Atlas kind maps + German inspector labels for new kinds (compat, not UI migration).

## Composition Gate

- Verdict: CLEAR
- Proof: `.qa/runs/composition-gate-semantic-taxonomy-v2.md`
- HEAD_SHA: 8d835db6075cf4074566a22ee776d4f096a1df18
