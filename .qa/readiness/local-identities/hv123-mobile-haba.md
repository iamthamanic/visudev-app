# Local Source Identity — HV123-Mobile-HABA

## Contract

| Field             | Value                                             |
| ----------------- | ------------------------------------------------- |
| `localProjectKey` | `HV123-Mobile-HABA`                               |
| `pathEnv`         | `VISUDEV_READINESS_HABA_PATH`                     |
| Remote            | **none** — do not invent a GitHub repository name |
| Kind              | Local dogfood reference already used by VisuDev   |

## Resolution rules

1. Read absolute path from `VISUDEV_READINESS_HABA_PATH`.
2. Path must exist and be a directory.
3. Basename (case-insensitive) must be one of:
   - `HV123-Mobile-HABA`
   - `hv123-mobile-haba`
4. Directory must contain a Tier-1 marker file: `package.json` **or** `capacitor.config.ts` **or** `capacitor.config.json`.
5. Optional content pin: when `contentFingerprintEnv` / manifest `source.contentFingerprint` is set, compare `sha256` of the marker file; mismatch → resolve failure.

## CI / missing path

When the env path is unset or invalid:

- Project source status = `UNAVAILABLE`
- Optional capabilities (including runtime exploration) = `UNAVAILABLE`
- Must **not** be reported as `PASS`
- PR gate does not invent a remote checkout for this project
