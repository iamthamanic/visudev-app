# Feature: Infrastructure view honesty (PR-15)

<!-- seeded for infrastructure-honesty / issue 389 -->

## Intent

Infrastructure UI shows only evidenced deployment/runtime/data/external entities, with honest ABSENT/NOT_DETECTED/UNSUPPORTED/UNKNOWN empty states. CPU/RAM meters require real telemetry. Unfinished controls are gated. No invented Internet nodes or live-refresh pretence.

## Preconditions

- Blueprint scan completed (or in progress / not scanned)
- Graph may contain Tier-1 infra nodes or none

## Happy Path

- [ ] Empty Infrastructure view surfaces coverage detection (ABSENT / NOT_DETECTED / UNSUPPORTED / UNKNOWN), not one generic “nichts gefunden”
- [ ] Partial scan shows TruncationBanner when file budget truncated
- [ ] Topology does not invent an Internet node when the graph has none
- [ ] Resource meters render only finite metadata fields; no NaN; no Uptime invention
- [ ] Inspector shows Status + Evidence (file/path refs or explicit empty)
- [ ] Connection legend only lists edge kinds present in the projection (or honest reference label)
- [ ] “Aktualisieren” is gated — does not imply live infra refresh

## Edge Cases

- [ ] Package/SDK-only infra (table nodes) still show DETECTED with file evidence
- [ ] External without file/source → UNKNOWN, not green DETECTED
- [ ] Physical topology hint mentions Dockerfile alongside Compose/K8s

## Regression

- [ ] Tier-1 detectors (#388) unchanged
- [ ] Logs button stays disabled with ControlHint
- [ ] Env/region chips only from real metadata

## Security Coverage

- **F-03**: No invented runtime metrics or cloud inventory
- **P-04**: Evidence excerpts already sanitized at graph build

## Verify

```bash
cd Visudevfigma
npm test -- --run src/modules/blueprint/components/InfrastructureView.test.tsx \
  src/modules/blueprint/components/infrastructure/infrastructure-entities.test.ts \
  src/modules/blueprint/components/infrastructure/infrastructure-coverage.test.ts
```
