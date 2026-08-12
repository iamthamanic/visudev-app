# P0-14 — Domänen aus Dateinamen

## Intent

For files still `domainSource: "none"` after P0-10, derive a filename stem and
promote it to a domain only when the stem appears in ≥2 layers and ≥2 files.
Never overwrite `domainSource: "path"`.

## Acceptance

- Path domains unchanged by Pass 2.
- Stem across two layers → filename domain; single-layer stem stays unassigned.
- Generic stems (index/main/…) never become domains.
- Architecture banner distinguishes majority path / filename / none.
- Unit tests in `_domain-from-filename.test.ts` + domain-source-hint.
