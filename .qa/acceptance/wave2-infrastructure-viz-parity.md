# Acceptance: wave2-infrastructure-viz-parity

## Intent

Infrastructure topology matches reference: full tiers, filters, resource meters, connection legend.

## Reference screenshot

`.qa/evidence/wave-2-references/visudev_infrastructure-d2086d92-b47b-4a15-9ce8-134520c76466.png`

## Visual checklist

- [ ] View title "INFRASTRUCTURE" with subtitle "Laufzeit- und Deployment-Topologie"
- [ ] Filter: Umgebung only when node metadata.env exists (P0-2; no invented Produktion)
- [ ] Filter: Region only when node metadata.region exists (P0-2; no invented eu-central-1)
- [ ] Filter: Ansicht (Logische Topologie)
- [ ] Aktualisieren button with refresh icon
- [ ] Internet node (globe) at top
- [ ] LOAD BALANCER / GATEWAY (NGINX) purple box
- [ ] 4 service cards: WEB APP, API SERVICE, WORKER, AUTH SERVICE with ports
- [ ] Data tier: POSTGRESQL, REDIS, STORAGE (S3)
- [ ] External APIs group: Email, Payment, SSO, HR Datenanbieter
- [ ] Monitoring tier: Prometheus, Grafana, Loki, Alertmanager
- [ ] Dashed connection lines between tiers
- [ ] Legend: HTTP, gRPC, Jobs, Datenzugriff, Externe Verbindung
- [ ] Inspector: selected node title + RUNNING badge
- [ ] Inspector: ÜBERSICHT only from real metadata (no invented Uptime/Instanzen)
- [ ] Inspector: RESSOURCEN bars only with real telemetry; otherwise `infra-runtime-empty`
- [ ] Inspector: VERBINDUNGEN eingehend/ausgehend
- [ ] "Logs anzeigen" footer button

## Playwright screenshot gate

```bash
PLAYWRIGHT_BASE_URL=http://localhost:3005 npx playwright test tests/e2e/wave2-infrastructure-viz.spec.ts --project=chromium
```

- Assert: `[data-testid="infra-topology-node"]` count ≥ 10
- Assert: `[data-testid="infra-external-apis"]` visible
- Assert: `[data-testid="infra-monitoring-tier"]` visible
- Click Web App → assert `[data-testid="infra-runtime-empty"]` visible (no invented meters)
- Screenshot topology + inspector

## Criteria

- [ ] All visual checklist items pass
- [ ] `npm run checks` green
