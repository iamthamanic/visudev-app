# VisuDEV

Developer tool to visualize deterministic flows from UI elements through code, API, SQL/RLS to backend systems. Screen-centric view with GitHub as source of truth and Supabase as backend.

## Quick start

```bash
npm i
npm run dev
```

**Voraussetzung:** [Docker Desktop](https://www.docker.com/products/docker-desktop/) (für lokales Supabase).

Damit starten **lokales Supabase** (Docker, :54321), **Edge Functions**, **VisuDEV-App** (Vite, :3005) und **Preview-Runner** (:4000). Kein Cloud-Zugriff nötig. Ein **Ctrl+C** beendet alle Prozesse.

Cloud stattdessen: `npm run dev:cloud` (siehe `.env.cloud.example`).

Open: **http://localhost:3005** (fester Port, siehe unten). Runner: http://localhost:4000. Sign in or create an account, connect GitHub in **Settings → Connections**, then create or select a project and run analysis (App Flow, Blueprint, Data).

## Scripts

| Command                  | Description                                                                              |
| ------------------------ | ---------------------------------------------------------------------------------------- |
| `npm run dev`            | **Default:** Lokales Supabase (Docker) + Functions + App + Runner — `docs/HYBRID_DEV.md` |
| `npm run dev:cloud`      | Cloud Supabase + lokale App/Runner — `.env.cloud.example` → `.env.local`                 |
| `npm run dev:hybrid`     | Alias für `npm run dev`                                                                  |
| `npm run dev:app`        | Nur Vite-Dev-Server (3005)                                                               |
| `npm run dev:runner`     | Nur Preview-Runner (4000)                                                                |
| `npm run seed:demo-user` | Demo-User in lokalem Supabase anlegen (`demo@visudev.local`)                             |
| `npm run build`          | Production build                                                                         |
| `npm run preview`        | Preview production build                                                                 |
| `npm run checks`         | Format, lint, typecheck, tests                                                           |
| `npm run format`         | Prettier + Deno fmt                                                                      |

## Project layout

- `src/` – Frontend (React, TypeScript, CSS Modules). Modules under `src/modules/` (projects, appflow, blueprint, data, logs, settings, shell).
- `src/supabase/functions/` – Edge Functions source (visudev-auth, visudev-analyzer, visudev-projects, etc.). Deploy with `supabase functions deploy <name>`.
- `supabase/` – Config, migrations, and deployed function copies. See `docs/SUPABASE_SETUP.md`.
- `docs/` – Setup and runbooks (`HYBRID_DEV.md`, `SUPABASE_SETUP.md`, `GITHUB_SECRETS.md`, `PREVIEW_RUNNER.md`).
- `.cursor/rules/` – Versionierte Cursor-Agent-Regeln (Workflow, Frontend, Supabase). Siehe `.cursor/README.md` und `AGENTS.md`.

## Dev-Server-Port (3005)

Der Vite-Dev-Server und `npm run preview` laufen fest auf **Port 3005** (`vite.config.ts`: `server.port` / `preview.port`). Mit `strictPort: true` bricht Vite ab, wenn 3005 belegt ist – so starten keine weiteren Instanzen auf anderen Ports. Andere Dienste sollten 3005 nicht verwenden, damit VisuDEV immer unter http://localhost:3005 erreichbar ist.

## Configuration

- **Supabase:** Default is **local (Docker)** via `npm run dev` — see `docs/HYBRID_DEV.md`. Cloud optional: `npm run dev:cloud` + `.env.cloud.example`.
- **GitHub OAuth:** Configure `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` in Supabase Dashboard → Edge Functions → Secrets for the auth function.
- **Live App (Preview):** VisuDEV can build and run the linked app from the repo. See `docs/PREVIEW_RUNNER.md`. Optional: add `visudev.config.json` in your app repo root (`buildCommand`, `startCommand`, `port`) so the Preview Runner builds and serves it correctly.

## Design and scope

- Design: Figma [visudev](https://www.figma.com/design/PtKgTCSh5UDKXJeSQ1WkbG/visudev).
- Scope and comparison to similar tools: `inspiration.md` (dependency/call-graph tools, phased plan).
- Implementation details: `src/IMPLEMENTATION_REPORT.md`, `src/IMPLEMENTATION_DETAILS.md`.
- Open work: `tickets2.md`.

## Recent changes

- **2026-08-12** — Memory-Viewer auf GitHub Pages; Status „Kürzlich erledigt“ + Decisions nachgezogen ([CHANGELOG](docs/CHANGELOG.md))
- **2026-08-12** — Phase 0 Honest Core: Pfad-/Dateinamen-Domänen, Edges, Security-Ehrlichkeit, CI Golden-Set ([CHANGELOG](docs/CHANGELOG.md))
- **2026-07-22** — Vertical-Slice-Strangler: Product-Slices hinter Public Entries ([CHANGELOG](docs/CHANGELOG.md))
- **2026-07-19** — Living documentation Bootstrap (`.project-memory/`, Status/Features/Changelog, Memory-Viewer)
- **2026-07-07** — Local Blueprint: `visudev-blueprint` basePath + Gastmodus; lokale Projekte mit `local_path` (`issue/7-blueprint-local-runner`)
- **2026-07-07** — `npm run dev` Fast-Start: Vite parallel zu Edge Functions (kein blockierender Health-Wait) (`issue/1-blueprint-engine-core`)
- **2026-07-07** — Fix `npm run dev` wenn Supabase-CLI Text vor/nach `status -o json` ausgibt (`issue/1-blueprint-engine-core`)
- **2026-07-07** — `npm run dev` startet lokales Supabase (Docker); Demo-Login `demo@visudev.local` / `npm run seed:demo-user` (`issue/1-blueprint-engine-core`)

---

Last updated: 2026-08-12 (auto on push).
