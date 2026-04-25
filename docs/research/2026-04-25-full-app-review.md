# 2026-04-25 Full App Review

This note records a full-app review pass after the first-run, mobile-surface, list-run, sync-trust, and details-focus hardening work.

This is evidence and release guidance, not product contract.

## Scope

The review asked whether Holdfast is coherent enough to keep pushing toward daily-driver use without another broad product rethink.

Reviewed surfaces:

- governing control docs and recent research
- guest shell and primary routes
- Add, Inbox, Now, Upcoming, Review, Lists, Settings
- editing stability across item details and secondary editors
- mobile layout and bottom navigation fit
- runtime/service-worker recovery edge behavior
- local tests, browser e2e, and staging hosted auth/sync validation

## Product conclusion

The current model still holds.

Do not restart the product direction around a new spine. The stronger move is to keep proving and tightening:

- `Now / Inbox / Upcoming / Review / Lists`
- text-first Add
- whole-list activation
- retrieval-first Review
- explicit scheduling and explicit list finish outcomes
- local-first work that can attach to sync without data loss

The remaining high-value work is reliability, proof, and restraint. More speculative product surface would be more likely to slow the app down than improve it.

## Findings and fixes

### `HF-REVIEW-001` - Secondary editor focus stability

- Severity: `P2`
- Status: `Closed`
- Area: Settings and routines

The previous item-details focus bug had the same underlying risk in secondary editors:

- `LongerViewEditor` was keyed by `settings.updatedAt`
- `WeeklyEditor` was keyed by `weeklyRecord.updatedAt`
- routine editor cards were keyed by `routine.id + routine.updatedAt`

Those keys could remount active editing surfaces during background refresh, causing draft loss or focus loss.

Fix:

- key editors by stable identity
- keep local draft state through background refresh
- adopt incoming refreshed data only when the editor is clean
- add regression coverage for longer-view and routine edits during background refresh

### `HF-REVIEW-002` - Blocked service-worker registration edge

- Severity: `P2`
- Status: `Closed`
- Area: runtime recovery

When Playwright blocked service-worker registration, the app logged a runtime error because the registration object could be unavailable before the app accessed `registration.waiting`.

This did not blank the UI, but it violated the boot-hardening standard: unsupported or blocked service-worker environments should degrade quietly.

Fix:

- tolerate an unavailable registration object and leave the app running
- re-probe with service workers blocked: no console errors

### `HF-REVIEW-003` - Mobile bottom-nav target height

- Severity: `P2`
- Status: `Closed`
- Area: mobile layout

The bottom nav stayed in one row and did not overlap page content, but on a 360px phone the nav links measured 43px high, just under the 44px target.

Fix:

- raise compact bottom-nav link min-height to 44px
- re-probe confirmed all five nav links measure 44px and content stays above the fixed nav

## Validation evidence

### Local

Passed:

- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`
- `npm run test:e2e`

Unit count after this pass:

- 24 test files passed
- 128 tests passed

Local browser e2e:

- guest shell
- auth callback direct load
- offline shell after first load
- legacy service-worker recovery
- details typing focus during background refresh

Custom route/device probe:

- 360x640 phone
- 390x844 phone
- 768x1024 tablet
- 1280x720 desktop
- routes checked: `/now`, `/inbox`, `/upcoming`, `/review`, `/lists`, `/settings`

Probe result:

- no route stuck on `Opening Holdfast`
- no route reported a blank shell
- no bottom-nav content overlap reproduced
- blocked service-worker probe returned no console errors after the fix

### Staging

`npm run release:staging` passed.

Staging deployment:

- alias: [holdfast-staging.pages.dev](https://holdfast-staging.pages.dev)
- deployment: [a25564cd.holdfast-staging.pages.dev](https://a25564cd.holdfast-staging.pages.dev)

Hosted validation passed:

- hosted shell smoke
- hosted auth smoke
- hosted sync smoke
- capture + attachment sync
- offline replay
- list creation + list-item sync
- later offline edit catch-up
- whole-list activation + focus sync

## Release posture

Staging is green for this review pass.

Production should not be promoted from the current dirty working tree. Production promotion should wait for:

- intentional review of the changed file set
- a committed production-ready state
- explicit production approval
- `npm run release:prod`

## Remaining known gaps

These are not regressions from this pass:

- voice memo recording and dictation are still not ported
- richer attachment preview is still not ported
- current-workspace restore/import is still not ported beyond the existing backup/recovery foundation
- broader real-device multi-device validation is still useful before relying on Holdfast as the only daily system

## Recommendation

The right next move is not another broad rethink.

Recommended order:

1. Review and commit the current work intentionally.
2. Promote the same validated state to production only after approval.
3. Keep the next development cycle focused on real daily use gaps, especially attachment/voice capture and remaining trust proof, not new navigation or dashboard surface.
