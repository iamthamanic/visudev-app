# Review #268 — P0-14 filename domains

ACCEPT

## Intent match

Pass 2 after P0-10: stems with ≥2 layers and ≥2 files become `domainSource: "filename"`. Path domains never overwritten.

## Findings

- None Critical / Important / Minor blocking ship.
- `detectLayer` order fix: Rails `app/models` / `app/controllers` before broad Next `app/` — required so layer-first fixtures span two layers.

## Checks

- `npm run checks` PASS
- Unit: `_domain-from-filename`, heuristics Rails layers, domain-source-hint
