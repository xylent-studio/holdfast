# Architecture

This file explains how the implementation honors the governing control docs.

## Chosen Direction

Holdfast is built as an installable web app with:

- React + TypeScript + Vite
- IndexedDB via Dexie for the device replica
- a mutation queue for future sync
- a PWA shell for installability and offline resilience
- a sync boundary shaped for Supabase auth, database sync, and file storage

## Product-Led Architecture Rules

### Sync-first, offline-resilient

The intended user experience is:

- signed in on multiple devices
- automatic sync as the normal path
- seamless offline continuation
- automatic recovery when connectivity returns

That means local persistence is not a side mode. It is the device-level replica behind a synced account-based product.

### IndexedDB instead of localStorage

The prototype stored the whole app in one `localStorage` blob, including embedded attachments. That is not safe to keep.

Dexie plus IndexedDB gives us:

- structured records
- table-level migrations
- blob storage for attachments
- incremental writes
- cleaner sync boundaries

### Mutation queue now, sync worker next

Writes already create mutation-log entries. That shapes the local write model for:

- eventual upload
- retry
- idempotent handling
- conflict inspection

The full sync engine is not wired yet, but the write path is already designed for it.

## Module Boundaries

- `src/domain`
  Product constants, schemas, selectors, and business logic.
- `src/storage/local`
  IndexedDB table definitions, bootstrapping, snapshot assembly, and write commands.
- `src/storage/sync`
  Provider-neutral contracts plus the Supabase config boundary.
- `src/features`
  Route-level product flows and dialogs.
- `src/app`
  Shell, routing, and top-level state.

## Naming Boundary

The product name for the command view is `Now`.

The current storage alias is still `today` in schemas and selectors. That is an intentional compatibility choice for the current foundation, not the desired long-term product language. When it changes, it should change through an explicit schema migration.

## Local Data Strategy

The local database stores:

- items
- daily records
- weekly records
- routines
- settings
- attachment metadata
- attachment blobs
- sync mutation log
- sync state

## Attachment Strategy

Attachments are split into:

- metadata rows
- blob rows

This keeps item records small and makes the remote mapping explicit:

- metadata in database tables
- binary payloads in Supabase Storage
- local blob cache retained for offline access

## PWA And Hosting

The current foundation includes:

- manifest
- installable start URL
- service worker
- runtime shell caching

The frontend output is intentionally compatible with Cloudflare Pages. Supabase is the preferred backend path for auth, database sync, and attachment storage.

## Expected Sync Model

1. User signs in.
2. The device writes to IndexedDB immediately.
3. Mutation records upload in the background.
4. Remote changes are pulled back into the local replica.
5. Attachments upload separately from metadata.
6. Offline changes remain safe until the network returns.

## Conflict Direction

Holdfast is single-user and multi-device. The conflict posture should be:

- never block local writes on the network
- keep mutation ids and timestamps explicit
- prefer preservation over silent loss
- use field-aware merges where daily records need them

## Intentionally Not Here Yet

- Supabase auth wiring
- sync worker implementation
- attachment preview pipeline
- voice memo recording port
- background retry worker

Those are roadmap items, not hidden assumptions.
