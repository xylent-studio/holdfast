# Daily-Driver Release Candidate Ledger

Date: 2026-04-25

Branch: `codex/holdfast-daily-driver-rc`

Linear project: `Holdfast V1 Daily Driver`

Linear backlog created from this ledger:

- `LEA-25` Configure GitHub hosted smoke secrets
- `LEA-26` Persist missing attachment payload availability
- `LEA-27` Tighten workspace backup attachment validation
- `LEA-28` Polish mobile action density in Add, List detail, and Upcoming
- `LEA-29` Design voice memo and dictation parity on the attachment model
- `LEA-30` Add evidence-based Review retrieval performance guardrails
- `LEA-31` Complete staging gate and production promotion for daily-driver RC

## Review Scope

This pass treated the current local app as a release candidate and reviewed it across six lanes:

- product charter and docs drift
- UX, mobile ergonomics, and action density
- sync, auth, offline, and trust state
- storage, backup, restore, and attachments
- CI, release, Cloudflare, and Supabase
- accessibility, performance, and retrieval

The core model stayed frozen: `Now / Inbox / Upcoming / Review / Lists`, text-first Add, whole-list activation, retrieval-first Review, explicit list finish outcomes, and local-first sync.

## Fixed Blockers

| Severity | Finding | Status | Acceptance proof |
| --- | --- | --- | --- |
| P1 | Modal focus could escape editing sheets. | Fixed | `src/test/modal.test.tsx` covers Tab and Shift+Tab trapping. |
| P1 | Attachment picker was hidden behind a non-keyboard file label. | Fixed | `src/test/item-details-dialog.test.tsx` verifies a focusable Add files button and file attachment path. |
| P1 | Primary scheduled Add could silently assign a date. | Fixed | `src/test/quick-add-dialog.test.tsx` verifies Schedule requires confirmation before saving. |
| P1 | Mobile Add became unavailable after scrolling past the top bar. | Fixed | Mobile shell now renders a compact Add affordance at small widths. |
| P1 | Inbox mobile routing exposed too much inline control. | Fixed | Inbox renders a compact mobile placement row with overflow for lower-frequency destinations. |
| P1 | Offline state could mask action-required auth recovery. | Fixed | `src/test/sync-engine.test.ts` covers wrong-account and detached-recovery precedence. |
| P1 | Legacy member work without a bound owner could bind to a new account. | Fixed | `src/test/auth.test.ts` covers unresolved member ownership. |
| P1 | Restore mutations could be blocked by stale remote revisions instead of restoring intentionally. | Fixed | Restore mutations bypass optimistic remote revision conflict checks by type. |
| P1 | Remote parent deletion could remove local items with unsynced attachment work. | Fixed | Sync now defers parent deletion into conflict when unsynced attachment work exists. |
| P1 | Workspace restore left old prototype undo sessions active. | Fixed | `src/test/workspace-backup.test.ts` verifies restore clears prototype recovery sessions. |
| P1 | Hosted validation workflow had invalid secret usage. | Fixed | Workflow checks missing secrets inside a shell step instead of job-level secret conditionals. |
| P1 | Staging env could be overridden by production shell env. | Fixed | Explicit env files now win over inherited process env in Pages validation. |
| P1 | Production deploy was not locked tightly enough to committed `origin/main`. | Fixed | Production Pages helper now refuses unpushed production deploys by default. |
| P1 | Production release did not prove staging on the same commit first. | Fixed | `release:prod` now runs staging validation before production promotion. |
| P1 | Staging release smoke could test an older public staging root after uploading a branch deployment. | Fixed | `release:staging` now uploads release candidates to the staging project's `main` branch label so `https://holdfast-staging.pages.dev` is the build under test. |
| P1 | Hosted whole-list sync smoke used UTC date keys and failed after local evening. | Fixed | The smoke now uses local date-key semantics to match Holdfast's `todayDateKey()` model. |
| P2 | Archived list retrieval reopened active editing controls. | Fixed | `src/test/list-view.test.tsx` and `src/test/local-api.test.ts` cover retrieval-only archived lists. |
| P2 | Review list-item jump scrolled but did not focus the matched row. | Fixed | Highlighted list rows now receive focus after Review drill-in. |
| P2 | Wrong-account recovery copy could imply attachment to the current account. | Fixed | Wrong-account recovery now states that the device will not attach to another account until resolved. |

## Remaining Non-Release-Blocking Backlog

| Severity | Finding | Recommended owner |
| --- | --- | --- |
| P2 | GitHub hosted smoke secrets are not configured in the repo. | Release/ops |
| P2 | Review search still scans synchronously over the full local snapshot. Add a debounce or index only when real dataset size proves it necessary. | Retrieval/performance |
| P2 | Missing attachment payload availability is not yet persisted as a first-class degraded attachment state. | Storage/attachments |
| P2 | Backup parser accepts inconsistent attachment payload markers. Tighten before broader import use. | Storage/backup |
| P2 | Add footer ordering, list detail density, and Upcoming secondary actions still need more mobile-specific polish. | UX/mobile |
| P3 | Bottom nav needs a 320px regression check even though the target phone widths passed quick QA. | UX/mobile |
| P3 | Audio capture parity should be designed against the existing attachment model before schema work. | Rich capture |

## Validation Status

Local validation after fixes:

- `npm run typecheck`: passed
- `npm run lint`: passed
- `npm run test`: passed, 24 files and 137 tests
- `npm run build`: passed
- `npm run test:e2e`: passed local/browser shell tests, with 8 hosted auth/sync tests skipped because hosted env was not set
- targeted Vitest lanes for modal, item details, Quick Add, sync engine, auth, workspace backup, inbox, list view, local API, Review, and Settings: passed
- in-app browser route smoke for `/now`, `/inbox`, `/upcoming`, `/review`, `/lists`, and `/settings`: passed after app boot wait, with zero console errors
- responsive route matrix: passed 36 route/width checks at 320, 360, 390, 430, 768, and 1280 pixels; no horizontal overflow, no two-row bottom nav, no stuck boot, zero console errors

Hosted staging and production promotion are still pending in this ledger until the final release pass is completed.

## Release Gate

Production promotion remains blocked until all of the following are true:

- full local gates pass on committed code
- staging deploy and hosted shell/auth/sync/offline validation pass for the same commit
- no unresolved P0/P1 blockers remain
- production deploy is from committed `origin/main`
- required hosted smoke secrets are configured or the local release scripts are explicitly accepted as the source of truth for that release
