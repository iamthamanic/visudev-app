# Composition gate — #388 infrastructure-detection

**HEAD_SHA:** `15491fff4d0763d3f1db7790519b0dd0ba29ed93`
**Verdict:** CLEAR

## Path

`extractFactsFromFile` / Tier-1 descriptors → Blueprint `infra-service`/`deploy-service` facts → SoftwareGraph promotion (`addFactEvidence`) → Infrastructure view (`isInfrastructureEntity` / physical sources).

## Simulations

| Case                  | Expected                                                                                      | Result                |
| --------------------- | --------------------------------------------------------------------------------------------- | --------------------- |
| Dockerfile + EXPOSE   | one deploy-service + ports; engine FROM → one infra-service                                   | matches tests         |
| package.json SDK deps | one infra-service per engine label (deduped)                                                  | matches tests         |
| .env.example secrets  | names only; `NAME=***`; DATABASE_URL does not invent PG                                       | matches tests         |
| no Tier-1 signals     | zero infra/deploy facts                                                                       | matches negative test |
| Cardinality           | N evidence lines → ≤N facts; graph nodes keyed by service/deploy id (no fan-out mail/webhook) | CLEAR                 |

## Skip?

Not skipped — multi-hop evidence→graph→UI, but no bulk side-effects / outbox.
