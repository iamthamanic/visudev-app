# Composition Gate — architecture-semantic-v2 (issue 381)

- HEAD_SHA: 5d134068d8676ebb66c8096206d989ed3a4ce9c5
- Date: 2026-10-04
- Verdict: CLEAR
- Note: Revalidated after E2E label expectation Modul→Technik only; semantic hops unchanged.

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
