# Holdfast Sync + Offline Spec

## Product stance
Holdfast is sync-first in user experience and offline-resilient in implementation.

The user should experience Holdfast as a modern signed-in app that stays in sync across devices with no manual management. Offline support is not a separate mode. It is a resilience feature.

## Success criteria
A user should be able to:
- use Holdfast on multiple devices as one continuous product
- make changes without wondering where the truth lives
- keep working while offline
- return online and trust the app to reconcile automatically
- avoid manual export/import in normal use
- avoid thinking about sync unless something truly needs attention

## Product-level rules
- Never frame the app as "local mode" versus "cloud mode."
- Never make sync feel optional or bolted on.
- Never require manual recovery for normal offline use.
- Prefer quiet status over noisy status.
- Preserve data over aggressive conflict resolution.
- Hide implementation mechanics unless the user must act.

## Source of truth model
The product should behave as though the user has one account-level state that follows them across devices.

Implementation may use local persistence, caches, optimistic updates, and background queues, but the user-facing model is:
- my data is mine
- my devices stay in sync
- offline work is safe
- the app catches up when it can

## Normal states
The product should usually feel like one of these:
- up to date
- syncing quietly
- saved offline and waiting to sync
- can't sync yet only when the reason is real and concrete
- needs attention only when recovery actually requires a decision

## User-facing status language
Good:
- Up to date
- Syncing...
- Saved offline
- Can't sync yet
- Couldn't sync yet
- Retry

Bad:
- Local persistence mode
- Upload pipeline failed
- Conflict resolution required
- Sync state mismatch
- Attachment queue stalled
- Rehydrating cache

## Offline behavior
When offline:
- the app should still open
- the app should still show recent trustworthy data
- the user should still be able to create, edit, complete, archive, and schedule items
- actions should save locally immediately
- media creation should feel immediate even if remote upload is pending
- the UI should stay calm

When connectivity returns:
- queued changes should sync automatically
- the app should not require user intervention unless there is a genuine unrecoverable ambiguity
- statuses should quietly clear when healthy

## Conflict philosophy
Holdfast should avoid visible conflict UX whenever possible through careful server/client architecture and merge rules.

If a visible conflict is unavoidable:
- prefer preserving both versions over risking silent loss
- show human choices, not implementation data
- keep the decision local and obvious
- never expose raw record diffs in normal UI
- do not make the user resolve conflicts that the system should be able to reconcile safely

## Item behavior under sync
For tasks and notes:
- local creation should feel instant
- edits should feel instant
- schedule changes should feel instant
- completion and archive actions should feel instant
- server acknowledgment should support trust, not block flow

For items changed on more than one device:
- avoid weird jumps in the UI
- avoid duplicate items caused by weak reconciliation
- preserve important context fields
- keep item identity stable

## Attachment and media behavior
Attachments, photos, and voice memos are not extras. They are real product data.

Rules:
- creation should feel immediate
- items should still exist even if media upload is pending
- pending media should not make the whole item feel broken
- the app should recover background uploads automatically
- failed media sync should be visible only when user attention matters
- media should never silently disappear because network state changed

## Failure handling
The app should distinguish between:
- temporary delay
- silent retry
- user-visible risk
- true action-required failure

Temporary delay:
- stay quiet or lightly indicate syncing

Silent retry:
- do it automatically

User-visible risk:
- show a clear, non-technical message
- distinguish "can't sync yet" from "couldn't sync yet"

True action-required failure:
- present a small set of obvious choices

## Stop-ship sync failures
Do not ship behavior where:
- an offline edit can disappear
- attachments can vanish silently
- two devices can create confusing duplicates too easily
- the user is asked to understand sync mechanics
- auth/session issues can make data feel untrustworthy without clear recovery
- the UI shows fake success before data is actually safe enough
