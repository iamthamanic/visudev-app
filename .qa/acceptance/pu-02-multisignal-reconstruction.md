# Feature: PU-02 · Reconstruct product concepts from multi-signal evidence

## Intent

Produktkonzepte aus mehreren unabhängigen technischen Signalen rekonstruieren, statt fachliche Bedeutung aus Ordnernamen oder einzelnen Routes abzuleiten.

## Happy Path

- [ ] `buildProductUnderstanding` combines semantic / UI / lineage / software signals when present.
- [ ] Product-area/capability/information require ≥2 distinct Truth sources on the shared key (no single path segment).
- [ ] Applications / external systems / UI user-actions may be single-source with evidence refs.
- [ ] Relations keep evidence; name-only semantic edges are skipped.
- [ ] Unit fixtures cover modular, layered, and messy structures without project-specific rules.

## Edge Cases

- [ ] Folder-first / structural names (`src`) never become product-area.
- [ ] Lone semantic capability without second source is dropped.
- [ ] Same key across kinds shares corroborating evidence on emit.

## Security Coverage

- Types/builder only — redacted evidence summaries + IDs; no secrets, no UI, no network.

## Implementation Notes

- `shared/product-understanding/build-product-understanding.ts`
- Tests: `build-product-understanding.test.ts`
