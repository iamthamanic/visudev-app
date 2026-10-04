# Feature: PR-02 · Introduce canonical knowledge, detection and coverage contracts

## Intent

Einen einheitlichen epistemischen Contract einführen, damit alle Analysepfade dieselben Begriffe für Wissen, Interpretation, Konflikte und Vollständigkeit verwenden.

## Happy Path

- [x] KnowledgeStatus ist exakt VERIFIED/SUPPORTED/INTERPRETED/UNKNOWN/CONFLICTED.
- [x] CoverageStatus ist COMPLETE/PARTIAL/UNAVAILABLE; DetectionState umfasst mindestens ABSENT/NOT_DETECTED/UNSUPPORTED/UNKNOWN/CONFLICTED.
- [x] Alte Snapshot-Status werden deterministisch kompatibel gelesen.
- [x] `originKind=llm` kann ausschließlich INTERPRETED erzeugen.
- [x] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Implementation Notes

- `shared/scan-detector/epistemic.ts` — canonical contracts + mappings
- `readKnowledgeStatus` / `coerceKnowledgeStatus` / `applyOriginKnowledgePolicy`
- Legacy SDE statuses remain valid on `ScanKnowledgeStatus` wire type

## Composition Gate

- Verdict: SKIPPED
- Reason: shared contract/types only; no multi-hop producer→consumer business event path
