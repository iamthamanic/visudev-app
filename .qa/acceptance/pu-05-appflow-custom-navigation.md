# Feature: PU-05 · Expand AppFlow detection for custom navigation architectures

<!-- refined by @implement from issue #426 -->

## Intent

AppFlow-Erkennung von framework-spezifischen Standardroutern entkoppeln und custom navigation architectures evidence-backed erfassen.

## Preconditions

- Repo-Dateien (Local oder GitHub) sind als `FileContent[]` verfügbar.
- Bestehende Screen-/UIInteractionGraph-Pipeline bleibt die kanonische Senke (kein zweites AppFlow-Modell).

## Happy Path

- [ ] Detector überführt object/typed route tables, path-builder call sites und switch/union view dispatch generisch in Screens → UIInteractionGraph.
- [ ] Jede neue Surface/Transition hat file/line evidence und ehrlichen status/confidence.
- [ ] Unknown computed paths erzeugen PARTIAL/UNKNOWN (kein erfundener Zielpfad).
- [ ] Tests nutzen eine custom-router Fixture ohne SagaDrive/Golden-Repo-Begriffe.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Edge Cases

- [ ] Nested / aliased route tables still yield literal path values only.
- [ ] Dynamic path-builder args and template literals → unknown surface, not invented path.
- [ ] Multiple routing systems in one app: custom-nav merges additively without wiping framework screens.

## Regression

- [ ] React Router / Next / page-like / modal-tab extraction still runs as before.
- [ ] Feed and topic routes still load (N/A for analyzer-only slice — no UI route changes).

## Assumptions

- Static regex/relationship patterns only; no execution of route functions.
- Capability coverage is reported via extract result + screen `framework: "custom-nav"` attributes.

## Security Coverage

| Item                  | Applicable   | How satisfied                                                           |
| --------------------- | ------------ | ----------------------------------------------------------------------- |
| F-03 XSS              | out-of-scope | No new UI render of untrusted HTML                                      |
| B-01 AuthZ            | out-of-scope | No new endpoints                                                        |
| B-04 Secrets          | yes          | No execution of analyzed router code; evidence summaries redaction-safe |
| B-07/B-08/B-09        | out-of-scope | No new storage/CORS/webhook                                             |
| P-04 Input validation | yes          | Path normalization rejects `javascript:` / absolute URLs                |

## Screenshots

| Step | Filename            |
| ---- | ------------------- |
| 1    | N/A (analyzer-only) |

## Implementation Notes

- Added \`shared/scan-detector/application/extract-custom-navigation.ts\` + merge helper.
- Wired \`CustomNavigationExtractor\` into \`ScreenExtractionService\` / \`ScreenService\` (additive).
- LegacyScreenLike/Screen carry knowledgeStatus/evidenceLine/confidence; adapt-legacy honors them.
- HarborDesk vitest fixture covers route table, path-builder, switch/union, UNKNOWN computed paths.
