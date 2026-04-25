# Roadmap

## Phase 1: Core Backbone

Status: complete

- archive the prototype
- establish the repo structure and control-doc contract
- build the React + TypeScript + Vite shell
- move local state to IndexedDB
- preserve the product spine that grew into `Now / Inbox / Upcoming / Review / Lists`
- add CI, lint, typecheck, tests, and build
- land backup export, prototype recovery, and undo support

## Phase 2: Auth, Sync, And Hosting Foundation

Status: complete enough for real staging and production hosted lanes

- Supabase Auth is wired with Google and magic-link paths
- callback handoff and session recovery are in place
- remote tables, RLS, mutation logging, and the browser sync engine exist
- a dedicated staging Supabase project exists for hosted validation
- provider-backed staging auth smoke passes
- same-account staged sync, attachment download, offline replay, and a common later-offline-edit catch-up path pass on staging
- Cloudflare Pages production hosting is live at `holdfast.xylent.studio`
- provider-backed production auth smoke passes
- same-account hosted sync, attachment download, offline replay, and a common later-offline-edit catch-up path pass on production

Still open in this lane:

- broader multi-device validation on real accounts
- richer conflict handling and merge behavior
- attachment upload lifecycle hardening
- delete-account flows
- staged Google OAuth allow-list parity and broader staged provider validation

## Phase 3: Product Realignment

Status: in progress

- keep centering the product on `catch / place / find / keep`
- remove leftover personal-system framing
- keep capture lighter than administration
- align Upcoming to `Scheduled / Undated / Waiting on`
- demote hand-holdy day structure so `Now` stays a command view
- make list surfaces real with a quiet dedicated `Lists` home
- strengthen Review and retrieval so saved things are easy to refind

Current evidence shaping this phase:

- The 2026-04-24 [36-voice product review](/C:/dev/GitHub/Holdfast/docs/research/2026-04-24-36-voice-product-review.md) found that the underlying model is stronger than the first-run presentation.
- The strongest near-term issues are first-run route/auth posture, list and mobile control density, silent scheduling defaults, and residual implementation/support language in primary trust surfaces.
- The strongest ideas to protect are text-first Add, whole-list activation, retrieval-first Review, and the `Now / Inbox / Upcoming / Review / Lists` spine.

## Phase 4: Trust And Recovery Hardening

- broader cross-device sync and offline replay validation
- attachment upload/download parity and cache lifecycle refinement
- current-workspace restore/import
- background retry strategy for problematic records
- explicit migration and version-invalidation refinement where needed

## Phase 5: Rich Context And Remaining Parity

- voice memo recording
- dictation
- richer attachment preview
- better preserved-context surfaces for files, screenshots, receipts, and media
- mobile fit and restraint polish

## Phase 6: Posture Before Public V1

- decide whether to keep or redirect the `*.pages.dev` hostname
- finish privacy-policy and account-management essentials
- validate the product on real repeated use, not just smoke passes
- keep cutting workflow theater, settings sprawl, and hand-holdy day rituals
