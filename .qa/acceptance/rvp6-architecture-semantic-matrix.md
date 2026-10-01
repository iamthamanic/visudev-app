# Acceptance: RVP-6 Architecture semantic matrix

## Intent

Architecture is projected as BusinessDomains × technical layers from `SemanticSystemModel`, not as folder-name domains.

## Contract

- Primary grouping uses `business-domain` entities from the canonical SemanticSystemModel.
- Technical layers (`ui`, `application`, `domain`, `data`, …) remain secondary cards inside each domain.
- Structural folder labels (`components`, `hooks`, `services`, …) are never promoted to BusinessDomains.
- Unassignable layer cards land under `Ohne Domäne`.
- No static demo domain/layer list invents entities without graph evidence.

## Automated checks

- [ ] Projection rejects structural folder domains.
- [ ] Projection groups layers by SemanticSystemModel memberships.
- [ ] Unassigned / structural-only cases stay under `Ohne Domäne`.
- [ ] `npm run checks` / CI Quality, E2E and Golden Set are green.

## Real-project gate

With enrichment OFF, `hrkoordinator` Architecture must show fachliche Domains instead of `components`/`hooks`/`services` as domain headers.
