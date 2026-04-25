# 2026-04-25 Details Focus Stability

This note records a real editing-stability defect and the fix. It is an engineering guardrail, not product contract.

## Symptom

While editing a task, note, capture, or other item in `Item details`, the active textbox could suddenly lose focus. The user could keep typing, but keyboard input no longer entered the field.

## Root cause

Two focus hazards overlapped:

1. `App` keyed `ItemDetailsDialog` by `item.id` plus `item.updatedAt`.
   - Any background item refresh that changed `updatedAt` remounted the dialog.
   - Remounting rebuilt local draft state and restarted modal focus behavior.

2. `Modal` restarted its focus effect whenever `onClose` identity changed.
   - Parent route renders often change inline callback identity.
   - The cleanup path restored focus to the previously active element, then the new effect could focus the modal sheet.
   - That could steal focus from an active input even without a dialog remount.

Sync was a plausible trigger, but not the only trigger. Any live-query refresh or local background write touching the open item could cause the same class of bug.

## Fix

- Keep the details dialog keyed only by stable item identity.
- Keep modal focus setup tied to open/closed state, not incidental callback identity.
- Store the latest `onClose` callback in a ref for Escape handling.
- Add a component regression proving parent rerenders do not steal focus from an active modal field.
- Add a browser regression proving an IndexedDB item refresh while details is open does not steal focus or wipe the draft field.

## Guardrail

Do not key an editing surface by mutable record metadata such as `updatedAt`, `syncState`, or `remoteRevision`.

For active editing surfaces:

- key by stable object identity only
- preserve unsaved local draft state across background refreshes
- avoid focus effects that rerun due to callback identity
- test the lived behavior with a browser test when the failure is about typing, focus, or cursor state

## Follow-up

The same mutable-key hazard was later found in secondary Settings editors and routine cards:

- `LongerViewEditor` keyed by `settings.updatedAt`
- `WeeklyEditor` keyed by `weeklyRecord.updatedAt`
- routine editor cards keyed by `routine.id + routine.updatedAt`

Those surfaces now use stable identity and preserve active drafts across background refresh. Clean editors still adopt refreshed data, but active typing is not remounted out from under the user.

## Files

- [src/app/App.tsx](/C:/dev/GitHub/Holdfast/src/app/App.tsx)
- [src/shared/ui/Modal.tsx](/C:/dev/GitHub/Holdfast/src/shared/ui/Modal.tsx)
- [src/features/settings/SettingsView.tsx](/C:/dev/GitHub/Holdfast/src/features/settings/SettingsView.tsx)
- [src/features/settings/RoutineSetupPanel.tsx](/C:/dev/GitHub/Holdfast/src/features/settings/RoutineSetupPanel.tsx)
- [src/test/modal.test.tsx](/C:/dev/GitHub/Holdfast/src/test/modal.test.tsx)
- [src/test/settings-view.test.tsx](/C:/dev/GitHub/Holdfast/src/test/settings-view.test.tsx)
- [tests/e2e/details-focus.spec.ts](/C:/dev/GitHub/Holdfast/tests/e2e/details-focus.spec.ts)
