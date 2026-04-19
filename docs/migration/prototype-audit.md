# Prototype Audit

Reference artifact:

- [archive/prototype/holdfast_proto_2026-04-18.html](/C:/dev/GitHub/Holdfast/archive/prototype/holdfast_proto_2026-04-18.html)

## What Exists In The Prototype

The prototype already proves the product shape better than a typical mockup.

Implemented behaviors:

- four-view spine: `Now/Today`, `Inbox`, `Upcoming`, `Review`
- date navigation across the whole app
- quick add for tasks and notes
- day-specific readiness checklist
- focus list with `top3` intent
- routine seeding on day start
- finish-day closeout with carry-forward generation
- Upcoming split into planned, queue, and waiting
- Review search across items and day records
- repeat detection for open loops
- weekly frame and settings
- attachment support for items
- voice memo capture in-browser
- export/import backup flows

## Real Domain Shape Extracted

The prototype's implicit model maps to these durable concepts:

- item
- daily record
- weekly record
- routine
- settings
- attachment

The prototype also mixed in UI and session state:

- current view
- current date
- filters
- sheet state
- toast and undo state

## Preserve

- `Now / Inbox / Upcoming / Review` as the product spine
- readiness as a short fixed checklist
- routines as seeded structure, not hidden automation
- finish-day carry-forward behavior
- review as search, repeats, and recent-day reflection
- notes and tasks sharing a common item model
- attachments as first-class item context

## Rework

- persistence layer
- schema boundaries
- attachment handling
- routing and shell architecture
- feature modularity
- sync readiness
- testing and CI

## Discard

- single-file architecture
- `localStorage` blob persistence
- base64 attachment storage inside the main app state
- hard-coded personal profile strings as defaults
- legacy migration cruft left in the runtime forever

## Obvious Bugs And Structural Risks

### 1. Attachment data is embedded in the main storage blob

Risk:

- storage quota exhaustion
- large slow writes
- corrupt-all-or-nothing persistence behavior

### 2. `addQuick()` references `day` without defining it

If that path is hit, it can throw a runtime reference error.

### 3. `snapshotDay(date)` ignores its `date` parameter

It snapshots `activeDay()` instead of using the passed date. The current call site happens to be safe, but the function is brittle.

### 4. Multiple orphaned or drifting fields exist

Examples:

- `launchNote`
- `linkedDate`
- `pinned`
- `imageData`
- `dayBlueprint`
- old preset routine constants

This indicates product drift inside the prototype and makes migration assumptions dangerous.

### 5. Focus is named as `top3` but not enforced to three

That is a mismatch between product intent and implementation.

### 6. Import and load normalization paths are inconsistent

The prototype has multiple migration and import paths with overlapping normalization logic, which is easy to break over time.

### 7. Legacy naming remains in storage and export paths

Examples:

- storage key: `justin-os-standalone-v1`
- backup filenames: `justin-system-backup-*`

These are safe to archive but not acceptable as the long-term product foundation.

## Migration Conclusion

The prototype is valuable as a behavioral reference and migration source, but unsafe as a codebase base layer.

It should remain archived and readable, not extended in place.
