# Data Model

## Overview

Holdfast is centered on a small set of explicit entities:

- item
- list
- list item
- daily record
- weekly record
- routine
- settings
- attachment
- attachment blob
- mutation record
- sync state
- workspace state

## User-Facing State Model

The product states are:

- `Inbox`
- `Now`
- `Upcoming`
- `Waiting on`
- `Done`
- `Archived`

Current storage mapping:

- product `Now` -> stored as `today`
- product `Waiting on` -> stored as `waiting`

That naming mismatch is known and documented. It should only change through a deliberate schema migration.

## Core Entities

### Item

Represents a capture, task, or note that participates in the main product spine.

Key fields:

- `id`
- `title`
- `kind`
- `lane`
- `status`
- `body`
- `sourceText`
- `sourceItemId`
- `captureMode`
- `sourceDate`
- `scheduledDate`
- `scheduledTime`
- `routineId`
- `completedAt`
- `archivedAt`
- `deletedAt`
- `syncState`
- `remoteRevision`

Notes:

- `kind` is no longer task/note-only; it must also support raw capture as a real first-step product object
- `sourceText` preserves the original thought quietly when the user reshapes an entry later
- `sourceItemId` links derived objects back to the original source when needed
- `captureMode` distinguishes uncertain capture, directed quick add, and in-context direct placement

### List

Represents a contextual list surface.

Key fields:

- `id`
- `title`
- `kind`
- `lane`
- `pinned`
- `sourceItemId`
- `archivedAt`
- `deletedAt`
- `syncState`
- `remoteRevision`

List kinds should cover:

- replenishment
- checklist
- project
- reference

### ListItem

Represents an entry inside a list surface.

Key fields:

- `id`
- `listId`
- `title`
- `body`
- `status`
- `position`
- `sourceItemId`
- `nowDate`
- `completedAt`
- `archivedAt`
- `deletedAt`
- `syncState`
- `remoteRevision`

### DailyRecord

Represents the operating state of one day.

Key fields:

- `date`
- `startedAt`
- `closedAt`
- `readiness`
- `focusItemIds`
- `launchNote`
- `closeWin`
- `closeCarry`
- `closeSeed`
- `closeNote`
- `seededRoutineIds`
- `remoteRevision`

### WeeklyRecord

Represents the weekly frame around the day.

Key fields:

- `weekStart`
- `focus`
- `protect`
- `notes`
- `remoteRevision`

### RoutineRecord

Represents recurring structure that brings items into `Now` or `Upcoming`.

Key fields:

- `title`
- `lane`
- `destination`
- `weekdays`
- `scheduledTime`
- `notes`
- `active`
- `remoteRevision`

### SettingsRecord

Represents the user's longer frame.

Key fields:

- `direction`
- `standards`
- `why`
- `remoteRevision`

### AttachmentRecord

Metadata for an attachment linked to an item.

Key fields:

- `itemId`
- `blobId`
- `kind`
- `name`
- `mimeType`
- `size`
- `remoteRevision`

### AttachmentBlobRecord

The local blob stored for offline access.

### MutationRecord

The local mutation queue entry used by the current sync engine.

Key fields:

- `entity`
- `entityId`
- `type`
- `payload`
- `status`
- `attempts`
- `lastError`

### SyncStateRecord

Tracks sync transport state for the device.

Key fields:

- `provider`
- `mode`
- `lastSyncedAt`
- `pullCursorByStream`

Notes:

- `pullCursorByStream` keeps a stable `(server_updated_at, primary key)` cursor per remote stream so tied timestamps do not get skipped on later pulls
- `lastSyncedAt` remains a transport watermark for status and legacy compatibility, not the only pull boundary anymore

### WorkspaceStateRecord

Tracks workspace ownership and attachment semantics on the current device.

Key fields:

- `ownershipState`
- `boundUserId`
- `authPromptState`
- `attachState`

Notes:

- workspace ownership is intentionally separate from sync transport health
- wrong-account protection and signed-out recovery are driven from this record, not from `syncState`
- a restored backup stays local-only while signed out, but it auto-attaches when the user restores while signed in or signs in later with the same account

### PrototypeRecoverySessionRecord

Local-only undo history for prototype recovery imports.

Key fields:

- `source`
- `summary`
- `createdItemIds`
- `createdRoutineIds`
- `createdAttachmentIds`
- `createdDailyRecordDates`
- `createdWeeklyRecordDates`
- `previousDailyRecords`
- `previousWeeklyRecords`
- `previousSettings`
- `undoneAt`

Notes:

- this table is intentionally local-only; it exists to make recovery reversible on the current device
- newer recoveries can be undone cleanly from recorded snapshots
- older recoveries that happened before undo support use a safer best-effort rollback path based on the same backup source

## Workspace Progression

The current public auth path is:

1. `device-guest`
2. `member`

`workspaceState.authPromptState` lets the app distinguish:

- calm signed-out state after explicit sign-out
- session-loss recovery
- wrong-account protection on a member-owned device workspace

`anonymous-user` is still reserved in the schema, but it is not the current V1 product path.

## Versioning

Every persistent entity includes:

- `schemaVersion`
- `createdAt`
- `updatedAt`
- sync metadata or sync-adjacent state where relevant

This keeps migrations explicit and searchable.

## Current Local Tables

Defined in [src/storage/local/db.ts](/C:/dev/GitHub/Holdfast/src/storage/local/db.ts).

- `items`
- `lists`
- `listItems`
- `dailyRecords`
- `weeklyRecords`
- `routines`
- `settings`
- `attachments`
- `attachmentBlobs`
- `mutationQueue`
- `prototypeRecoverySessions`
- `workspaceRestoreSessions`
- `syncState`
- `workspaceState`

## Remote Shape Foundation

Current Supabase mapping:

- Postgres tables for items, lists, list items, daily records, weekly records, routines, settings, attachment metadata, and deletion tombstones
- a private `holdfast-attachments` bucket for attachment binaries
- auth-scoped rows per user
- `user_id`-scoped RLS policies on every user-owned table
- storage policies that scope attachment access to the owning authenticated user
- a browser sync engine translating local mutation records into remote upserts, deletes, and pull-based replica updates

## Migration Note

The prototype used:

- a single JSON blob in `localStorage`
- embedded attachment data URLs
- mixed UI, domain, and persistence fields

The new model intentionally separates those concerns.

Current extension direction:

- keep the `Now / Inbox / Upcoming / Review / Lists` spine intact
- add raw-capture preservation without forcing immediate classification
- make list promotion honest through `ListItemRecord.nowDate` instead of duplicate top-level task projections
- keep lists contextual while also giving them a quiet top-level library home
- preserve migration sanity by evolving the schema deliberately rather than smuggling list semantics into the existing task/note shape

## Manual Backup Export

The app can export a manual workspace backup from the current local replica.

That backup intentionally includes:

- items
- lists and list items
- daily and weekly records
- routines
- settings
- attachment metadata plus attachment payloads when they are still available locally or can be rehydrated

That backup intentionally excludes:

- mutation queue internals
- sync state
- local-only recovery-session history

This keeps the file user-meaningful instead of leaking device bookkeeping into a backup the user may actually need later.

Per-record sync bookkeeping is stripped from the exported JSON.
If an attachment file is missing on the device and cannot be rehydrated, the backup now preserves the attachment metadata with an explicit missing-payload marker instead of failing the whole export.

## Manual Backup Restore

The app can now restore a Holdfast backup file back into the current device workspace.

Current restore behavior is deliberate:

- items, lists, list items, routines, settings, and attachment state from the backup replace the current device workspace
- day and week history from the backup restore by date instead of blindly wiping every local row
- the last restore records an on-device undo snapshot so the user can reverse it cleanly
- the mutation queue is rebuilt from the final restored state so signed-in sync can catch up honestly
- pre-existing non-acknowledged deletions that still matter stay queued instead of being erased by the rebuild
- restore clears remote pull cursors and rebuilds sync state so the restored workspace can attach honestly on the next valid sign-in

Attachment behavior during restore:

- embedded attachment payloads restore locally and queue for sync
- missing-payload attachments restore as metadata-only rows, reintroduce their metadata to sync, and rely on later rehydration when possible

This keeps backup restore trustworthy without pretending that every historical row should be deleted blindly across devices.
