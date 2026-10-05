# Security Review — whole-repo-audit (2026-10-05)

**Verdict:** FAIL ship (grade D)  
**Source:** [Full-repo security audit](74aabbbe-1058-427b-9bed-9ee54509339a)

## Critical

1. `kv_store_edf036ef` — no RLS / REVOKE; PostgREST + anon key risk
2. Plaintext GitHub / serviceKey / LLM keys in KV

## High (priority)

- preview-runner tokenless `/start` returns live `projectToken`
- Unauthenticated analyze/browse; default `$HOME` jail
- local-engine unauthenticated CRUD on loopback
- `VITE_*` guest/demo secrets in SPA
- GitHub webhook accepts unsigned when secret unset; CORS `*`

## Checklist

| ID   | Verdict              |
| ---- | -------------------- |
| F-03 | PASS\*               |
| B-01 | FAIL (local runners) |
| B-04 | PASS                 |
| B-07 | PASS                 |
| B-08 | FAIL                 |
| B-09 | MIXED                |
| P-04 | FAIL                 |

## Top remediations

1. RLS + revoke on KV; rotate secrets
2. Stop token disclosure on `/start`
3. Auth analyze/browse; shrink roots
4. Remove `VITE_*` guest/demo secrets
5. Fail-closed webhooks + CORS allowlist
