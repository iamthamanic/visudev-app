# Feature: PU-01 · Introduce canonical Product Understanding contracts

## Intent

Eine einzige architecture-agnostic Product-Understanding-Schicht über den vorhandenen Truth-Modellen einführen, damit alle verständlichen Views dieselbe fachliche Bedeutung konsumieren und keine View eigene Business-Inference erfindet.

## Happy Path

- [ ] `ProductUnderstandingModel` is runtime-neutral, versioned (`version: 1`), and importable without React/provider deps (`shared/product-understanding`).
- [ ] Concepts cover application / product-area / capability / information / system-part / external-system / user-action / unknown; UNKNOWN and INTERPRETED are allowed without inventing kinds.
- [ ] Relations / impacts / stories carry `evidence` + `KnowledgeStatus`; `isAuthoritativeProductRelation` rejects empty-evidence (name-only) edges.
- [ ] SoftwareGraph / SemanticSystemModel / UIInteractionGraph / DataLineage type files remain source-compatible (no ProductUnderstanding coupling).
- [ ] Touched files: zero type escape hatches (typed-strict).

## Edge Cases

- [ ] One technical node maps to multiple concepts via `technicalRefs`.
- [ ] No fachliches Konzept → kind `unknown` + KnowledgeStatus UNKNOWN (no invented taxonomy).
- [ ] Conflicting evidence → KnowledgeStatus CONFLICTED still type-valid.
- [ ] Empty / partial model via `emptyProductUnderstandingModel`.
- [ ] Multiple applications → separate concept ids (`buildProductConceptId`).

## Regression

- [ ] Existing shared Truth contracts still typecheck / unit-test.

## Security Coverage

- F-xx / B-xx: N/A — types-only, no UI/API/auth surface.
- P-04 secrets: PASS — evidence refs allow redacted `summary` + IDs only; no raw source payloads; module forbids React/`VITE_*`.

## Assumptions

- Builders (PU-02+) consume these contracts; this ticket ships shape + identity helpers only.

## Screenshots

| Step | Filename         |
| ---- | ---------------- |
| n/a  | (contracts only) |

## Implementation Notes

- `shared/product-understanding.types.ts` — model + kinds
- `shared/product-understanding/index.ts` — identity / authority helpers
- `shared/product-understanding/product-understanding.test.ts` — contract tests
