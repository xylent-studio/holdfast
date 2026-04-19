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
- `promotedItemId`
- `completedAt`
- `archivedAt`
- `deletedAt`
- `syncState`

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

### WeeklyRecord

Represents the weekly frame around the day.

Key fields:

- `weekStart`
- `focus`
- `protect`
- `notes`

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

### SettingsRecord

Represents the user's longer frame.

Key fields:

- `direction`
- `standards`
- `why`

### AttachmentRecord

Metadata for an attachment linked to an item.

Key fields:

- `itemId`
- `blobId`
- `kind`
- `name`
- `mimeType`
- `size`

### AttachmentBlobRecord

The local blob stored for offline access.

### MutationRecord

The local mutation queue entry used by future sync.

Key fields:

- `entity`
- `entityId`
- `type`
- `payload`
- `status`
- `attempts`
- `lastError`

### SyncStateRecord

Tracks provider mode and auth state for the device.

Key fields:

- `provider`
- `mode`
- `authState`
- `identityState`
- `remoteUserId`
- `lastSyncedAt`

## Session Progression

The intended account path is:

1. `device-guest`
2. `anonymous-user`
3. `member`

`authState` tracks whether there is an authenticated backend session. `identityState` tracks what kind of workspace owner the device is currently attached to.

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
- `syncState`

## Remote Shape Direction

Planned Supabase mapping:

- Postgres tables for items, lists, list items, daily records, weekly records, routines, settings, and attachment metadata
- Storage buckets for attachment binaries
- auth-scoped rows per user
- anonymous users distinguished in RLS through Supabase auth claims
- a sync worker translating local mutation records into remote upserts and deletes

## Migration Note

The prototype used:

- a single JSON blob in `localStorage`
- embedded attachment data URLs
- mixed UI, domain, and persistence fields

The new model intentionally separates those concerns.

Current extension direction:

- keep the existing `Now / Inbox / Upcoming / Review` spine intact
- add raw-capture preservation without forcing immediate classification
- add first-class list primitives without creating a second navigation model
- preserve migration sanity by evolving the schema deliberately rather than smuggling list semantics into the existing task/note shape
