# Holdfast

Holdfast is a personal operating system for daily control, capture, prioritization, and reflection.

It is not a generic productivity suite. The core product spine is:

- `Now`: the command view for the day
- `Inbox`: fast capture before overthinking
- `Upcoming`: planned, later, and waiting-on work
- `Review`: retrieval, reflection, and repeated-loop visibility

This repo contains:

- a real React + TypeScript + Vite app foundation
- IndexedDB-backed local persistence shaped as a durable device replica
- a sync-ready mutation queue and Supabase boundary for signed-in continuity
- a device-guest to member auth model with Google first and magic-link fallback
- Cloudflare Pages and Wrangler groundwork for the eventual public deploy
- control docs, implementation docs, and agent guidance for long-term development
- archived source artifacts from the prototype and manager control-pack drop

## Read First

- [docs/docs-index.md](/C:/dev/GitHub/Holdfast/docs/docs-index.md)
- [AGENTS.md](/C:/dev/GitHub/Holdfast/AGENTS.md)

## Agent Re-Entry

On machines that have the local intel workspace, start deeper repo work with:

`.\scripts\rehydrate-agent.ps1`

If the task already has a clear theme, pass a trigger:

`.\scripts\rehydrate-agent.ps1 -Trigger "device-guest sync and now today alias"`

For product-intent or anti-regression work:

`.\scripts\rehydrate-agent.ps1 -Trigger "product meaning and guardrails"`

This helper is a local continuity aid. Repo docs, code, config, and generated machine-state remain the source of truth.

## Stack

- Frontend: React 19 + TypeScript + Vite
- Local persistence: IndexedDB via Dexie
- Validation/schema layer: Zod
- Routing: React Router
- Testing: Vitest
- Formatting/linting: Prettier + ESLint
- CI: GitHub Actions
- PWA foundation: manifest + service worker
- Deployment direction: Cloudflare Pages + Wrangler

## Quick Start

```bash
npm install
npm run dev
```

Validation:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

## Local Tooling

Verified in this workspace:

- `rg` / ripgrep is installed and working
- `git`, `node`, `npm`, and `codex` are installed and working
- Wrangler CLI is installed as a project dev dependency and available through `npx wrangler` or the npm scripts below
- Supabase CLI is installed as a project dev dependency and available through `npx supabase` or the npm scripts below

Account-linked tools may still need login depending on the machine:

- GitHub CLI is installed at `C:\Program Files\GitHub CLI\gh.exe`
- verify GitHub auth with `gh auth status`
- verify Cloudflare auth with `npm run cf:whoami`

Still missing for local Supabase stack work:

- Docker or another Docker-compatible container runtime

Useful commands:

```bash
npm run cf:whoami
npm run cf:pages:status
npm run cf:pages:validate
npm run test:e2e:hosted -- --base-url https://holdfast-validation.pages.dev
npm run supabase -- --version
npm run supabase:link
npm run supabase:status
```

## Repo Map

- [src/app](/C:/dev/GitHub/Holdfast/src/app): shell, routing, app bootstrap
- [src/domain](/C:/dev/GitHub/Holdfast/src/domain): product language, schemas, selectors, pure logic
- [src/storage/local](/C:/dev/GitHub/Holdfast/src/storage/local): IndexedDB schema and local write model
- [src/storage/sync](/C:/dev/GitHub/Holdfast/src/storage/sync): sync contracts and Supabase config boundary
- [src/features](/C:/dev/GitHub/Holdfast/src/features): route-level product flows
- [docs](/C:/dev/GitHub/Holdfast/docs): control docs, implementation docs, migration docs
- [archive](/C:/dev/GitHub/Holdfast/archive): preserved prototype and manager inputs

## Key Docs

- [docs/docs-index.md](/C:/dev/GitHub/Holdfast/docs/docs-index.md)
- [docs/control/docs-index.md](/C:/dev/GitHub/Holdfast/docs/control/docs-index.md)
- [docs/product.md](/C:/dev/GitHub/Holdfast/docs/product.md)
- [docs/core-flows.md](/C:/dev/GitHub/Holdfast/docs/core-flows.md)
- [docs/architecture.md](/C:/dev/GitHub/Holdfast/docs/architecture.md)
- [docs/auth-and-accounts.md](/C:/dev/GitHub/Holdfast/docs/auth-and-accounts.md)
- [docs/data-model.md](/C:/dev/GitHub/Holdfast/docs/data-model.md)
- [docs/deployment.md](/C:/dev/GitHub/Holdfast/docs/deployment.md)
- [docs/roadmap.md](/C:/dev/GitHub/Holdfast/docs/roadmap.md)
- [docs/migration/prototype-audit.md](/C:/dev/GitHub/Holdfast/docs/migration/prototype-audit.md)
- [docs/migration/prototype-gaps.md](/C:/dev/GitHub/Holdfast/docs/migration/prototype-gaps.md)

## Source Artifacts

- archived prototype: [archive/prototype/holdfast_proto_2026-04-18.html](/C:/dev/GitHub/Holdfast/archive/prototype/holdfast_proto_2026-04-18.html)
- archived manager drop: [archive/manager-inputs/2026-04-18_holdfast_control_pack_v2](/C:/dev/GitHub/Holdfast/archive/manager-inputs/2026-04-18_holdfast_control_pack_v2)

## Sync Status

The current app foundation is offline-capable and shaped for a sync-first signed-in product:

- the local database is the device replica
- writes already create mutation-log entries for future sync
- the session model centers on `device-guest` and `member`; `anonymous-user` remains schema-reserved but is not the current product path
- auth and remote sync are wired, but stay dormant until Supabase env vars and provider setup are present
- the foreground tab runs periodic browser sync while signed in; no open tab means no retries yet

Environment variables live in [.env.example](/C:/dev/GitHub/Holdfast/.env.example).

Reference:

- [Supabase CLI docs](https://supabase.com/docs/guides/local-development/cli/getting-started)
