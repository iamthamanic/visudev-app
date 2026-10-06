# Composition Gate — pu-02-multisignal-reconstruction (#423)

- HEAD_SHA: `ffe12f073c1bfe573d2df745ee47a6a519913590`
- Date: 2026-10-06
- Verdict: CLEAR

## Event

Truth models → `buildProductUnderstanding` → `ProductUnderstandingModel` concepts/relations

## Hop chain

semantic/UI/lineage/software collectors → key corroboration (≥2 sources) → concept emit + relation map

## Simulations

| Case              | Intended                    | Composed                                     | Result |
| ----------------- | --------------------------- | -------------------------------------------- | ------ |
| folder-only `src` | no product-area             | structural key rejected / single-source drop | pass   |
| modular billing   | concept with multi evidence | semantic+UI → product-area                   | pass   |
| lone capability   | dropped                     | single source                                | pass   |
| messy inventory   | area via graph+UI           | domain node + surface                        | pass   |

## Flags

| Tag    | Severity | Hops | Why | Fix |
| ------ | -------- | ---- | --- | --- |
| (none) | —        | —    | —   | —   |
