# Feature: PR-06 · Cut Atlas over to SemanticSystemModel v2

## Intent

Atlas auf das fachlich/systemische v2-Modell cutovern statt rohe technische Knoten semantisch aufzublasen.

## Happy Path

- [x] Primäre Atlas-Cluster stammen aus v2 semantic kinds, nicht raw file/route labels.
- [x] Resource/technical-module wird nicht als Business Domain gerendert.
- [x] Inspector zeigt KnowledgeStatus, Confidence und Evidence.
- [x] UNKNOWN/INTERPRETED ist visuell von VERIFIED/SUPPORTED unterscheidbar.
- [x] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Edge Cases

- [x] Keine Business Domain erkannt → technical overview clusters (honest fallback).
- [x] Mehrere applications.
- [x] Nur INTERPRETED candidates → weak tone badge.

## Regression

- [x] Atlas search / legend / inspector still load (`npm run checks` PASS)

## Assumptions

- Depends on SemanticSystemModel v2 on main (issue 379 / PR 401).

## Screenshots

| Step | Filename                          |
| ---- | --------------------------------- |
| 1    | N/A (component tests + static UI) |

## Implementation Notes

- Wire `selectedSemanticEntity` into Atlas Inspector overview/details.
- `AtlasSemanticEvidenceSection` + knowledge tone CSS (strong/weak/conflict).
- Legend lists v2 kinds + KnowledgeStatus tones; node cards show status inline.
- Primary overview: application/business-domain/capability; resources via search only.

## Composition Gate

- Verdict: CLEAR
- Proof: `.qa/runs/composition-gate-atlas-semantic-v2.md`
