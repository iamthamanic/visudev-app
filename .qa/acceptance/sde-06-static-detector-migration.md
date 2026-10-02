# Acceptance — SDE-06 Static Detector Migration (#341)

## Intent

Adapt existing Blueprint static SoftwareGraph analysis behind ScanDetector ports without rewriting heuristics. Legacy builder stays available; shadow compare uses semantic baseline.

## Acceptance

- [ ] Engine facts round-trip to SoftwareGraph without losing baseline-covered legacy facts/edges
- [ ] `buildSoftwareGraph` / SemanticSystemModel contracts remain consumable via legacy export
- [ ] Shadow compare reports Missing/Extra/Changed semantically
- [ ] Legacy static path retained (`buildLegacySoftwareGraph`) until SDE-15
- [ ] Zero type escape hatches

## Verification

- `npx vitest run shared/scan-detector/static-detector-bridge.test.ts local-engine/src/scan-detector/static-blueprint-detector.test.ts`
- `npm run checks`
