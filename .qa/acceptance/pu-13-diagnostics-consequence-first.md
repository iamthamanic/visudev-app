# Acceptance — PU-13 Diagnostics consequence-first

**Issue:** #434  
**Slug:** `pu-13-diagnostics-consequence-first`

## Intent

Diagnostics consequence-first: Nutzer sehen zuerst Produkt-/Nutzerauswirkung, danach technische Ursache.

## Acceptance

- [x] Finding-Defaultcopy beginnt mit evidence-grounded consequence/why-it-matters und nicht Rule-ID/Mechanismus.
- [x] Wenn Konsequenz nicht sicher ableitbar ist, zeigt UI neutral `Auswirkung unklar` statt Spekulation.
- [x] Technical rule/mechanism/file evidence bleibt in Level-2/3 Inspector erreichbar.
- [x] Default-Dichte wird reduziert und Partial Scan wird sichtbar kommuniziert.
- [x] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Composition Gate

- Verdict: SKIPPED
- Reason: read-only finding presenter/UI; no producer–consumer side effects.
