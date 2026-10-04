# Composition Gate — architecture-semantic-v2 (issue 381)

- HEAD_SHA: 4fe8b64dc75b1ea652c7e2637593d4f69b10eb52
- Date: 2026-10-04
- Verdict: CLEAR

## Event

SemanticSystemModel (engine or shared builder) → Architecture domain/capability districts + inspector evidence.

## Hops

1. resolveArchitectureSemanticModel selects authority (no UI reclassification).
2. groupArchitectureCardsBySemanticDomains maps layers via memberships.
3. Inspector shows KnowledgeStatus + evidence refs for selected memberships.

## Simulations

| Case                             | Expected                      | Observed |
| -------------------------------- | ----------------------------- | -------- |
| Folder domain without membership | Ohne Domäne / nothing-found   | PASS     |
| Business-domain memberships      | District labels from semantic | PASS     |
| No semantic entities             | Unassigned honest empty       | PASS     |

## Cardinality / identity

- No side-effect fan-out.

## Findings

None open.
