# Prototype Gaps

This document tracks what the new foundation still lacks relative to the prototype and the intended production architecture.

## Already Addressed

- real repo structure
- modular React app shell
- versioned local data model
- IndexedDB storage
- attachment and blob separation
- mutation queue for future sync
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

### Export/import

The prototype could export and import a backup payload. Not yet ported into the new app.

### Attachment preview UX

The prototype had inline preview paths for image, audio, and file viewing. The new app currently stores attachments and supports download and remove, but not rich preview yet.

## Not Yet Built But Required For Product Intent

### Supabase auth

Required to make the app feel like a normal signed-in multi-device product.

### Sync engine

Needed to move from sync-shaped local writes to actual account-based continuity.

### Attachment upload pipeline

Needed to move from the local blob cache to seamless cross-device media availability.

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
