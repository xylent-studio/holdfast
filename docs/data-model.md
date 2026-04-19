# Data Model

## Overview

Holdfast is centered on a small set of explicit entities:

- item
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

Represents a task or note.

Key fields:

- `id`
- `title`
- `kind`
- `lane`
- `status`
- `body`
- `sourceDate`
- `scheduledDate`
- `scheduledTime`
- `routineId`
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

- Postgres tables for items, daily records, weekly records, routines, settings, and attachment metadata
- Storage buckets for attachment binaries
- auth-scoped rows per user
- a sync worker translating local mutation records into remote upserts and deletes

## Migration Note

The prototype used:

- a single JSON blob in `localStorage`
- embedded attachment data URLs
- mixed UI, domain, and persistence fields

The new model intentionally separates those concerns.
