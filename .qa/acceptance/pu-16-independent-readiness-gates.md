# Feature: PU-16 · Independent product-understanding readiness gates

## Intent

Readiness-Zertifizierung so reparieren, dass jede Product Surface eigenständig beweisen muss; AppFlow/Data dürfen nicht optional durchrutschen.

## Happy Path

- [x] `run-project-gate.mjs` setzt Atlas/Architecture/Dependencies/Execution/Infrastructure/Diagnostics/Evolution nicht mehr aus einem gemeinsamen Boolean.
- [x] AppFlow Static und Data sind für comprehension-certified Tier-1 projects required; Runtime bleibt nur optional.
- [x] Jede Surface schreibt eigenes machine-readable verdict + reason + evidence artifact; aggregate FAIL benennt die konkrete Surface.
- [x] Readiness-Manifest/Gates erlauben keine PASS-Zertifizierung, wenn eine required Product Surface nur UNAVAILABLE/PARTIAL ist.
- [x] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Edge Cases

- [x] Optional runtime without secrets → UNAVAILABLE (not FAIL)
- [x] Required PARTIAL → aggregate FAIL naming surface
- [x] Independent semantic failure classification

## Composition Gate

- Verdict: SKIPPED
- HEAD_SHA: a391b730c4470e345712c5561cd424d00e403eb8
- Reason: Readiness harness scripting; no side-effect fan-out.
