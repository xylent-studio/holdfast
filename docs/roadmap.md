# Roadmap

## Phase 1: Foundation

Status: mostly complete

- archive the prototype
- establish repo structure
- add docs and agent guidance
- build the React + TypeScript + Vite shell
- move to IndexedDB
- preserve the `Now / Inbox / Upcoming / Review` structure
- add CI, lint, typecheck, tests, and build
- merge the manager control docs into the real docs tree

## Phase 2: Parity And Product Gaps

- port voice memo recording
- port dictation
- port richer attachment preview
- finish current-workspace restore/import flows
- tighten focus behavior
- improve finish-day ergonomics

## Phase 3: Auth And Sync

- create the Supabase project
- add Google OAuth
- add email magic link fallback
- finish auth flow and callback handoff
- add remote tables and row-level security
- define local-to-account attach behavior and merge rules
- implement mutation upload worker
- implement pull reconciliation
- add attachment upload pipeline
- add quiet, product-native sync status UI

## Phase 4: Offline Hardening

- background retry strategy
- conflict handling for problematic records
- attachment cache lifecycle
- explicit migration runner
- PWA cache/version invalidation refinement

## Phase 5: Launch And Hosting

- authenticate Cloudflare tooling and MCP access
- keep using the disposable Pages validation project for hosted smoke
- production Pages project exists and `holdfast.xylent.studio` is live
- fix Supabase Auth URL configuration so production-domain auth no longer falls back to validation
- decide whether to keep or redirect the `*.pages.dev` hostname
- run provider-backed auth smoke on production
- run cross-device and offline smoke tests against the hosted build

## Phase 6: Product Refinement

- stronger review heuristics
- tighter upcoming scheduling interactions
- better daily and weekly transitions
- mobile polish
- cross-device trust and resilience testing
