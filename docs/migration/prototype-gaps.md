# Prototype Gaps

This document tracks what the new foundation still lacks relative to the prototype and the intended production architecture.

## Already Addressed

- real repo structure
- modular React app shell
- versioned local data model
- IndexedDB storage
- attachment and blob separation
- mutation queue and browser sync foundation
- Supabase auth shell and signed-out landing
- remote Supabase schema with RLS-scoped user tables
- attachment upload/download flow through Supabase Storage
- lint, typecheck, tests, build, and CI
- PWA installability foundation
- control-doc integration into the main docs tree
- user-facing `Now` naming in the shell

## Conflicts Surfaced By The Manager Control Pack

### `Today` vs `Now`

The previous foundation used `Today` as the public label. The control docs define `Now` as canonical.

Current state:

- user-facing shell and docs now use `Now`
- internal storage and selector naming still use `today`

This is acceptable for now, but it remains a deliberate migration item.

### System-authored UI copy

The previous shell still had strings that exposed implementation mechanics.

Current state:

- core shell copy was tightened
- the biggest product-language leaks were removed

This still needs an ongoing review pass as features grow.

## Not Yet Ported From The Prototype

### Voice memo recording

The prototype had in-browser audio recording. The new app currently supports attachment storage, but not direct microphone capture yet.

### Dictation

The prototype exposed speech-to-text capture in some flows. Not yet ported.

### Prototype recovery import

The new app now includes a deliberate recovery path for earlier prototype data:

- recover from the old browser cache when the app is running on the same origin
- import a prototype backup JSON file when the earlier cache lives on another origin
- merge imported items, routines, daily records, weekly records, settings, and attachments without wiping the current workspace
- undo newer recoveries cleanly on-device through recorded recovery-session history
- let older recoveries roll back from the same browser source or backup file, using a best-effort safety-first undo path when pre-undo snapshots do not exist

General workspace backup export now exists. Holdfast backups can now also be restored back into the current device workspace with recorded on-device undo for the last restore.

### Attachment preview UX

The prototype had inline preview paths for image, audio, and file viewing. The new app currently stores attachments and supports download and remove, but not rich preview yet.

## Not Yet Built But Required For Product Intent

### Richer conflict handling

Needed to move from safe basic sync toward broader multi-device merge confidence.

### Background sync and retry

Needed for resilient offline-to-online reconciliation.

## Why These Gaps Were Deferred

This pass prioritized:

- getting out of the single-file prototype trap
- making the data model and storage safe
- preserving the product spine
- aligning the repo with the governing control docs
- leaving behind a repo future agents can extend coherently

That was the right order. Shipping auth and sync on top of the prototype architecture would have hardened bad assumptions.
