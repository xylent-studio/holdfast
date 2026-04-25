# 2026-04-24 Readiness Audit

This document records the readiness-audit-first pass for the current Holdfast branch after the guest-shell, explicit-scheduling, and calmer-surface hardening work.

This is evidence, not product contract.

## Scope

The goal of this pass was to answer one question:

> Is the current local product good enough to trust, or are there still blockers that make staging or later production promotion dishonest?

The core product model stayed frozen during this pass:

- `Now / Inbox / Upcoming / Review / Lists`
- text-first Add
- whole-list activation
- retrieval-first Review
- explicit finish-list outcomes

## Evidence used

### Local validation

- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run test:e2e`

### Staging validation

- `npm run release:staging`
- hosted shell smoke against [holdfast-staging.pages.dev](https://holdfast-staging.pages.dev)
- hosted auth smoke against [holdfast-staging.pages.dev](https://holdfast-staging.pages.dev)
- hosted sync smoke against [holdfast-staging.pages.dev](https://holdfast-staging.pages.dev)

### Manual/local product walkthroughs

- guest-shell route checks on `Now`, `Inbox`, `Upcoming`, `Review`, `Lists`, and `Settings`
- Add -> `Save to Inbox`
- Add -> `Choose another place`
- Add -> new reference list
- Inbox -> schedule confirmation
- Inbox -> list conversion
- whole-list run surfaces
- Settings trust/account copy

## Blocker ledger

## `HF-READINESS-001`

- Severity: `P1`
- Status: `Closed`
- Area: hosted sync / whole-list activation

### Symptom

Staging hosted sync smoke failed on same-account cross-context whole-list activation and focus. The list could show `Focus` locally while the remote `scheduled_date` never updated, so the second signed-in context never saw the active list correctly.

### Root cause

The sync engine could mark a newer local record as `synced` when an older in-flight mutation finished. A later remote pull could then overwrite the newer local state with the older remote row.

This was a real release blocker because it broke trust in the local-first sync contract for a core list-run workflow.

### Fix

- preserve newer local state when an older remote write returns
- rebase `remoteRevision` onto the current local record without falsely calling it synced
- immediately run follow-up sync passes while new pending mutations still exist from mid-flight local edits
- add a unit regression test for the in-flight overwrite case
- expand hosted sync smoke to cover whole-list activation and focus across signed-in contexts

### Files

- [src/storage/sync/supabase/engine.ts](/C:/dev/GitHub/Holdfast/src/storage/sync/supabase/engine.ts)
- [src/test/sync-engine.test.ts](/C:/dev/GitHub/Holdfast/src/test/sync-engine.test.ts)
- [tests/e2e/hosted-auth.helpers.ts](/C:/dev/GitHub/Holdfast/tests/e2e/hosted-auth.helpers.ts)
- [tests/e2e/hosted-sync.spec.ts](/C:/dev/GitHub/Holdfast/tests/e2e/hosted-sync.spec.ts)

## `HF-READINESS-002`

- Severity: `P1`
- Status: `Closed`
- Area: release validation tooling

### Symptom

Hosted auth smoke still asserted the deprecated signed-out landing copy instead of the current guest shell, causing a false-negative staging failure.

### Root cause

The test suite had not been updated to the approved guest-shell contract.

### Fix

Update hosted auth smoke to assert the real guest shell on clean hosted load.

### Files

- [tests/e2e/hosted-auth.spec.ts](/C:/dev/GitHub/Holdfast/tests/e2e/hosted-auth.spec.ts)

## `HF-READINESS-003`

- Severity: `P2`
- Status: `Closed in 2026-04-25 follow-up`
- Area: mobile layout density

### Observation

On smaller phone-height viewports, the fixed bottom nav can visually encroach on lower-page content in the first viewport on longer screens such as `Now`, `Inbox`, `Settings`, and some list/detail surfaces.

### Why it stays open

This did not block truthful evaluation, state changes, or release confidence in the current pass. It belongs to the next targeted compaction/polish wave rather than the readiness audit.

### Planned phase

Phase 2 targeted UX/product polish.

### Follow-up

The 2026-04-25 full-app review rechecked the fixed bottom nav across phone, tablet, and desktop widths. Content overlap did not reproduce, and compact bottom-nav links were raised to the 44px target.

## Result

Readiness-audit conclusion:

- no open `P0`
- no open `P1`
- one open `P2` documented for the next polish wave

The current branch is now credible enough to continue into targeted polish and deeper sync/trust proof without rethinking the product model again.
