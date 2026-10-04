# Feature: PR-07 · Cut Architecture over to explicit domain, capability and technical layers

## Intent

Architecture klar nach fachlicher Struktur und technischer Implementierung trennen.

## Happy Path

- [x] Architecture trennt Business Domain, Capability, Service, Technical Module und Resource/Data Store.
- [x] Product slice führt keine eigene semantische Klassifikation mehr aus.
- [x] Unassigned/Unknown bleibt explizit.
- [x] Drill-down führt von Entity zu Source Evidence.
- [x] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Edge Cases

- [x] Service ohne Domain → Ohne Domäne
- [x] Capability teilt Services (capability districts when no business-domain)
- [x] Kein Business Layer nachweisbar → honest empty / unassigned

## Regression

- [x] Architecture view loads; `npm run checks` PASS

## Assumptions

- Semantic authority is shared SemanticSystemModel v2 (or blueprint.semanticSystemModel).

## Implementation Notes

- `resolveArchitectureSemanticModel` prefers engine payload, else shared builder.
- Domain grouping uses memberships only — no folder/metadata classification.
- Kind summary bar + inspector KnowledgeStatus/evidence drill-down.
- Level nav: System / Fachdomäne / Capability / Technik / Datei.

## Composition Gate

- Verdict: CLEAR
- Proof: `.qa/runs/composition-gate-architecture-semantic-v2.md`
