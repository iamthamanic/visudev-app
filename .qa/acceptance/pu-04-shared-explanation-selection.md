# Feature: PU-04 · Add shared human explanation and semantic selection contract

## Intent

Gemeinsame Explanation- und Selection-Schicht, damit Views dieselben Produktkonzepte gleich erklären und Selection über View-Grenzen tragen können.

## Happy Path

- [ ] Presenter liefert Level 1/2/3 aus ProductUnderstandingModel.
- [ ] ProductConcept selection (id + optional evidence) ist URL/query-safe.
- [ ] UNKNOWN/INTERPRETED/CONFLICTED werden nicht als bestätigt formuliert.
- [ ] Shared inspector section data covers purpose / why / impact / status / evidence.
- [ ] Typed-strict on touched files.

## Edge Cases

- [ ] Concept ohne Datei / external system
- [ ] Selection nicht in Ziel-View → presentInView false, id unverändert

## Security Coverage

- Redacted evidence summaries only; no new source dumps.

## Implementation Notes

- `shared/product-understanding/explanation-presenter.ts`
- `shared/product-understanding/selection.ts`
- `shared/product-understanding/inspector-sections.ts`
- Blueprint: `ProductConceptInspector.tsx`, selection re-exports
