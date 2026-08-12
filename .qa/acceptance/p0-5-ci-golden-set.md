# Feature: P0-5 — CI Golden Set

## Intent

Die CI misst den echten lokalen Blueprint-Analyzer an einem eingefrorenen Express-/Prisma-Fixture ohne Demo-Enrichment. Separate Quality-, Demo-E2E- und Golden-Set-Jobs verhindern, dass Analyzer-Regressionen hinter einem grünen Demo-Graphen verborgen bleiben.

## Implementation Notes

- Ein echtes Express-/Prisma-Fixture, der Node-ESM-Golden-Set-Runner und
  90%-Untergrenzen wurden ergänzt.
- `.github/workflows/ci.yml` trennt Quality, Demo-E2E und echten Analyzer;
  der Metatest schützt die Enrichment-Grenzen.
- Die E2E-Bestandsaufnahme endete mit 50/50 grünen Tests ohne `test.skip`;
  drei veraltete Selektoren und zwei zuvor übersprungene kritische Pfade wurden
  repariert.
- Bekannte Vertragsinkonsistenz: Die exakt vorgegebene Fixture-Struktur hat
  zehn analysierbare Dateien, weshalb `FILE_LIMIT = 10` keinen Messwert senkt.
  Der Kontrolllauf mit `FILE_LIMIT = 8` beweist die Schwellenfunktion; Details
  stehen in `.qa/queue/runs/issue-260.md`.
