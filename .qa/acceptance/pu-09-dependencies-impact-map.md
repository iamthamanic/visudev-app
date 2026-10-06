# Acceptance — PU-09 Dependencies impact map

**Issue:** #430  
**Slug:** `pu-09-dependencies-impact-map`

## Intent

Dependencies beantwortet Change Impact für Produktkonzepte (direkt + begrenzt transitiv), nicht primär technische Topology-Edges.

## Acceptance

- [ ] Default Dependencies beantwortet Change Impact für Product Concepts statt primär technische topology edges zu zeigen.
- [ ] Direkter und transitiver Impact sind visuell unterscheidbar; transitive Expansion ist hart begrenzt und drill-down-fähig.
- [ ] Jede sichtbare Relation zeigt plain-language meaning, KnowledgeStatus und Evidence/Why-it-matters.
- [ ] UNKNOWN/CONFLICTED werden nie als bestätigter Impact formuliert.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Composition Gate

- Verdict: SKIPPED
- Reason: read-only PU impact projection/UI; no producer–consumer side effects.
