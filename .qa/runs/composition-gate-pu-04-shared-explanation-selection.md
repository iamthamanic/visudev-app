# Composition Gate — pu-04-shared-explanation-selection (#425)

- HEAD_SHA: `c5a348d581ddaa211cfd53c4b4f594ccc674bba5`
- Date: 2026-10-06
- Verdict: CLEAR

## Event

ProductUnderstandingModel + conceptId → explanation presenter → inspector sections / URL selection

## Hop chain

presentProductConceptExplanation → buildProductConceptInspectorSections → ProductConceptInspector (Blueprint)
createProductConceptSelection → serialize / searchParams → resolveProductConceptSelectionForView

## Simulations

| Case            | Intended                      | Result |
| --------------- | ----------------------------- | ------ |
| UNKNOWN concept | hedge language, not confirmed | pass   |
| URL round-trip  | conceptId preserved           | pass   |
| missing in view | presentInView false           | pass   |

## Flags

none
