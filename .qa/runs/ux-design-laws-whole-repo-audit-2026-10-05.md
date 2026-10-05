# UX Design Laws — whole-repo-audit (2026-10-05)

**Verdict:** PARTIAL  
**Source:** [UX laws + UI surfaces audit](3f422b4c-18b2-4ced-96ec-15ed31b30304)

## Strongest

- Honest-Core gates + German empty/error copy (`ViewState`, Blueprint gates)
- Lineage epistemic badges / truncation (`DataLineagePanel`)
- `TruncationBanner` on Atlas / Dependencies / Infrastructure

## Weakest

- Hick FAIL: Architecture, Diagnostics, Evolution, App Flow density
- Zeigarnik FAIL: Architecture / Diagnostics / Execution / Evolution missing partial-scan banner
- Postel PARTIAL: Data/lineage errors lack dedicated retry; ViewState retry only on `error`

## Cross-surface

- Jakob PARTIAL: Data/AppFlow bespoke empty cards vs shared Blueprint `ViewState`
- Von Restorff PARTIAL: export pairs compete with rescan on App Flow / Blueprint header
