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
- port export/import flows
- tighten focus behavior
- improve finish-day ergonomics

## Phase 3: Auth And Sync

- create the Supabase project
- add auth flow
- add remote tables and row-level security
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

## Phase 5: Product Refinement

- stronger review heuristics
- tighter upcoming scheduling interactions
- better daily and weekly transitions
- mobile polish
- cross-device trust and resilience testing
