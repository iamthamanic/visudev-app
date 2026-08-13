# Acceptance: wave2-execution-viz-parity

## Intent

Execution trace view matches reference: pipeline cards, timeline, metrics bar, 7 tabs, live badge.

## Reference screenshot

`.qa/evidence/wave-2-references/visudev_execution-21d6b4b7-ce63-414d-b7db-1f1d1d38d927.png`

## Visual checklist

- [ ] View title "EXECUTION" with German subtitle (Echtzeit-Trace)
- [ ] Mode badge: Projektion (default) or Live only when executionStatus is running
- [ ] Filters: time range, flow (LeaveRequest), status
- [ ] Trace ID + Gesamtdauer header (e.g. 364ms)
- [ ] 8 horizontal StepCards connected by dashed arrows
- [ ] Each step: number, icon, title, subtitle, duration, green checkmark
- [ ] Step colors distinct (blue, teal, indigo, orange, green, light blue, medium blue, purple)
- [ ] Timeline ruler below pipeline (0ms–364ms marks)
- [ ] Metrics bar: Gesamtdauer, Schritte, Fehler, Warnungen, Services, DB, Events, Payload
- [ ] "Als Ablaufdiagramm anzeigen" action button
- [ ] Left SCHRITTE list with 8 items, selection highlight
- [ ] Right detail: Schritt X von 8, status badge, duration
- [ ] 7 tabs: Übersicht, Payload, Headers, Logs, Stacktrace, Tags, Code-Standort
- [ ] Übersicht shows DETAILS metadata table
- [ ] Payload tab shows syntax-highlighted JSON request/response with Kopieren buttons
- [ ] Tags row with grey pills (http.method, feature, etc.)

## Playwright screenshot gate

```bash
PLAYWRIGHT_BASE_URL=http://localhost:3005 npx playwright test tests/e2e/wave2-execution-viz.spec.ts --project=chromium
```

- Assert: `[data-testid="execution-mode-badge"]` visible (Projektion unless running)
- Assert: `[data-testid="execution-step-card"]` count ≥ 6
- Assert: `[data-testid="execution-metrics-bar"]` visible
- Assert: `[data-testid="execution-detail-tab-payload"]` has JSON content after tab click
- Screenshot pipeline + detail panel

## Criteria

- [ ] All visual checklist items pass
- [ ] `npm run checks` green
